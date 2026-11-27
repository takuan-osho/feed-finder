// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const rootDir = dirname(fileURLToPath(import.meta.url));
const headersPath = resolve(rootDir, "public/_headers");
const indexHtml = readFileSync(resolve(rootDir, "index.html"), "utf8");

/**
 * Parse the Cloudflare static assets `_headers` file into
 * `{ [urlPattern]: { [lowercase header name]: value } }`.
 */
function parseHeadersFile(
  content: string,
): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {};
  let currentPattern: string | null = null;

  for (const rawLine of content.split("\n")) {
    if (rawLine.trim() === "" || rawLine.trim().startsWith("#")) continue;

    if (!/^\s/.test(rawLine)) {
      currentPattern = rawLine.trim();
      rules[currentPattern] = {};
      continue;
    }

    const separatorIndex = rawLine.indexOf(":");
    if (currentPattern === null || separatorIndex === -1) {
      throw new Error(`Malformed _headers line: ${rawLine}`);
    }
    const name = rawLine.slice(0, separatorIndex).trim().toLowerCase();
    rules[currentPattern][name] = rawLine.slice(separatorIndex + 1).trim();
  }

  return rules;
}

function parseCsp(csp: string): Record<string, string[]> {
  const directives: Record<string, string[]> = {};
  for (const part of csp.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) directives[name] = values;
  }
  return directives;
}

describe("static asset security headers (public/_headers)", () => {
  const readRules = () => parseHeadersFile(readFileSync(headersPath, "utf8"));

  it("defines headers for every static asset path", () => {
    expect(existsSync(headersPath)).toBe(true);
    expect(readRules()).toHaveProperty("/*");
  });

  it("sets a Content-Security-Policy without unsafe script sources", () => {
    const csp = parseCsp(readRules()["/*"]["content-security-policy"] ?? "");

    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["script-src"]).toEqual(["'self'"]);
    expect(csp["connect-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
  });

  it("sets clickjacking, sniffing, referrer and transport headers", () => {
    const headers = readRules()["/*"];

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");

    const hsts = headers["strict-transport-security"] ?? "";
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
  });
});

describe("index.html is compatible with the Content-Security-Policy", () => {
  it("has no inline scripts (script-src 'self' would block them)", () => {
    const scriptTags = indexHtml.match(/<script\b[^>]*>/gi) ?? [];

    expect(scriptTags.length).toBeGreaterThan(0);
    for (const tag of scriptTags) {
      expect(tag).toMatch(/\ssrc=/);
    }
  });

  it("has no inline event handler attributes", () => {
    expect(indexHtml).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it("does not reference third-party origins", () => {
    expect(indexHtml).not.toMatch(/(?:href|src)=["'](?:https?:)?\/\//i);
  });

  it("loads the theme bootstrap script from the same origin", () => {
    expect(indexHtml).toContain('<script src="/theme-init.js"></script>');
    expect(existsSync(resolve(rootDir, "public/theme-init.js"))).toBe(true);
  });
});
