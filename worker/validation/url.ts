import { err, ok, Result } from "neverthrow";

import type { ValidationError } from "../types";

/**
 * Safe URL creation wrapper using Result type
 */
export const safeCreateUrl = Result.fromThrowable(
  (url: string) => new URL(url),
  (): ValidationError => ({
    type: "INVALID_URL_FORMAT" as const,
    message: "Invalid URL format",
  }),
);

const ALLOWED_PROTOCOLS = ["http:", "https:"];
const ALLOWED_PORTS = ["80", "443", "8080", "8443"];

/** Suffixes that only resolve on internal networks (e.g. metadata.google.internal) */
const INTERNAL_HOSTNAME_SUFFIXES = [".local", ".internal"];

type Cidr = readonly [network: number, prefixLength: number];

const ipv4 = (a: number, b: number, c: number, d: number): number =>
  ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;

/** IPv4 loopback range, reported with the localhost message */
const IPV4_LOOPBACK: Cidr = [ipv4(127, 0, 0, 0), 8];

/** IPv4 ranges that are not publicly routable */
const IPV4_BLOCKED_RANGES: readonly Cidr[] = [
  [ipv4(0, 0, 0, 0), 8], // "this network"
  [ipv4(10, 0, 0, 0), 8], // private
  [ipv4(100, 64, 0, 0), 10], // CGNAT shared address space
  [ipv4(169, 254, 0, 0), 16], // link-local / cloud metadata service
  [ipv4(172, 16, 0, 0), 12], // private
  [ipv4(192, 0, 0, 0), 24], // IETF protocol assignments
  [ipv4(192, 168, 0, 0), 16], // private
  [ipv4(198, 18, 0, 0), 15], // benchmarking
  [ipv4(224, 0, 0, 0), 4], // multicast
  [ipv4(240, 0, 0, 0), 4], // reserved, includes 255.255.255.255
];

/** IPv6 prefixes that are not publicly routable, as [hextets, prefixLength] */
const IPV6_BLOCKED_PREFIXES: readonly (readonly [number[], number])[] = [
  [[0xfc00], 7], // unique local (fc00::/7, includes fd00::/8)
  [[0xfe80], 10], // link-local
  [[0xff00], 8], // multicast
  [[0, 0, 0, 0, 0, 0xffff], 96], // IPv4-mapped
  [[0x64, 0xff9b, 0, 0, 0, 0], 96], // NAT64
  [[0x2002], 16], // 6to4
];

const localhostError = (): ValidationError => ({
  type: "URL_NOT_PERMITTED" as const,
  message: "Access to localhost is not permitted",
});

const privateIpError = (): ValidationError => ({
  type: "URL_NOT_PERMITTED" as const,
  message: "Access to private IP addresses is not permitted",
});

const inCidr = (address: number, [network, prefixLength]: Cidr): boolean => {
  const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
  return (address & mask) >>> 0 === (network & mask) >>> 0;
};

/**
 * Parses a dotted-quad IPv4 address into a 32-bit number.
 * Returns null if the string is not a canonical dotted quad.
 */
function parseIpv4(hostname: string): number | null {
  const parts = hostname.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) {
    return null;
  }
  const octets = parts.map(Number);
  if (octets.some((octet) => octet > 255)) {
    return null;
  }
  const [a, b, c, d] = octets;
  return ipv4(a, b, c, d);
}

/**
 * Expands an IPv6 address (without brackets) to 8 hextets.
 * Supports "::" compression and an embedded dotted-quad IPv4 tail.
 * Returns null if the address cannot be parsed.
 */
export function expandIpv6(address: string): number[] | null {
  let text = address;
  const tail: number[] = [];

  const lastColon = text.lastIndexOf(":");
  const lastGroup = text.slice(lastColon + 1);
  if (lastGroup.includes(".")) {
    const embedded = parseIpv4(lastGroup);
    if (embedded === null) return null;
    tail.push(embedded >>> 16, embedded & 0xffff);
    // Drop the IPv4 tail; keep "::" intact but remove a lone separator
    text = text.slice(0, lastColon + 1);
    if (!text.endsWith("::")) text = text.slice(0, -1);
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (part: string): string[] =>
    part === "" ? [] : part.split(":");
  const head = parseGroups(halves[0]);
  const rest = halves.length === 2 ? parseGroups(halves[1]) : [];

  const groupCount = 8 - tail.length;
  const toHextets = (groups: string[]): number[] | null => {
    const values: number[] = [];
    for (const group of groups) {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
      values.push(parseInt(group, 16));
    }
    return values;
  };

  const headValues = toHextets(head);
  const restValues = toHextets(rest);
  if (headValues === null || restValues === null) return null;

  const explicit = headValues.length + restValues.length;
  if (halves.length === 2) {
    if (explicit >= groupCount) return null;
    const zeros = new Array<number>(groupCount - explicit).fill(0);
    return [...headValues, ...zeros, ...restValues, ...tail];
  }
  if (explicit !== groupCount) return null;
  return [...headValues, ...tail];
}

const matchesIpv6Prefix = (
  hextets: number[],
  [prefix, prefixLength]: readonly [number[], number],
): boolean => {
  for (let bit = 0; bit < prefixLength; bit += 16) {
    const index = bit / 16;
    const bits = Math.min(16, prefixLength - bit);
    const mask = (0xffff << (16 - bits)) & 0xffff;
    if ((hextets[index] & mask) !== ((prefix[index] ?? 0) & mask)) {
      return false;
    }
  }
  return true;
};

function checkIpv6(hostname: string): Result<void, ValidationError> {
  const hextets = expandIpv6(hostname.slice(1, -1));
  if (hextets === null) {
    // Fail closed: an IPv6 literal we cannot parse is never fetched
    return err(privateIpError());
  }
  const isZeroUntilLast = hextets.slice(0, 7).every((value) => value === 0);
  if (isZeroUntilLast && hextets[7] === 1) {
    return err(localhostError());
  }
  if (isZeroUntilLast && hextets[7] === 0) {
    return err(privateIpError()); // unspecified address "::"
  }
  if (
    IPV6_BLOCKED_PREFIXES.some((prefix) => matchesIpv6Prefix(hextets, prefix))
  ) {
    return err(privateIpError());
  }
  return ok(undefined);
}

function checkIpv4(address: number): Result<void, ValidationError> {
  if (inCidr(address, IPV4_LOOPBACK)) {
    return err(localhostError());
  }
  if (IPV4_BLOCKED_RANGES.some((range) => inCidr(address, range))) {
    return err(privateIpError());
  }
  return ok(undefined);
}

function checkHostname(rawHostname: string): Result<void, ValidationError> {
  const lowered = rawHostname.toLowerCase();
  // Strip one trailing dot so "localhost." and "host.internal." are caught
  const hostname = lowered.endsWith(".") ? lowered.slice(0, -1) : lowered;

  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return checkIpv6(hostname);
  }

  const address = parseIpv4(hostname);
  if (address !== null) {
    return checkIpv4(address);
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return err(localhostError());
  }

  if (INTERNAL_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return err({
      type: "URL_NOT_PERMITTED" as const,
      message: "Access to internal hostnames is not permitted",
    });
  }

  return ok(undefined);
}

/**
 * Validates URLs to prevent SSRF attacks using Result type
 * Blocks access to private IP ranges, localhost, and metadata services
 *
 * The WHATWG URL parser has already normalized the hostname: IPv4 forms such
 * as `2130706433`, `0x7f.1` and `127.1` become `127.0.0.1`, and IPv6 literals
 * are compressed and lower-cased. All checks therefore run on that
 * normalized hostname.
 *
 * Known residual risk: a public hostname that resolves to a private IP
 * (including DNS rebinding) cannot be detected here, because Workers have no
 * DNS resolution API.
 */
export function validateTargetUrl(url: string): Result<URL, ValidationError> {
  return safeCreateUrl(url).andThen((parsedUrl) => {
    // Only allow HTTP/HTTPS protocols
    if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      return err({
        type: "URL_NOT_PERMITTED" as const,
        message: "Only HTTP/HTTPS protocols are supported",
      });
    }

    // Credentials can leak into logs and disguise the real host
    if (parsedUrl.username !== "" || parsedUrl.password !== "") {
      return err({
        type: "URL_NOT_PERMITTED" as const,
        message: "URLs with credentials are not permitted",
      });
    }

    return checkHostname(parsedUrl.hostname).andThen(() => {
      // Restrict port numbers (block uncommon ports)
      const port = parsedUrl.port;
      if (port && !ALLOWED_PORTS.includes(port)) {
        return err({
          type: "URL_NOT_PERMITTED" as const,
          message: "Access to this port is not permitted",
        });
      }
      return ok(parsedUrl);
    });
  });
}
