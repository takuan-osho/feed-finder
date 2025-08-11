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

/**
 * Validates URLs to prevent SSRF attacks using Result type
 * Blocks access to private IP ranges, localhost, and metadata services
 */
export function validateTargetUrl(url: string): Result<URL, ValidationError> {
  return safeCreateUrl(url).andThen((parsedUrl) => {
    // Only allow HTTP/HTTPS protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return err({
        type: "URL_NOT_PERMITTED" as const,
        message: "Only HTTP/HTTPS protocols are supported",
      });
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost and loopback addresses
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname === "0:0:0:0:0:0:0:1" ||
      hostname === "0000:0000:0000:0000:0000:0000:0000:0001"
    ) {
      return err({
        type: "URL_NOT_PERMITTED" as const,
        message: "Access to localhost is not permitted",
      });
    }

    // Block private IP address ranges
    const privateRanges = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^169\.254\./, // 169.254.0.0/16 (link-local/metadata service)
      /^\[fc00:/, // fc00::/7 (IPv6 private) - IPv6 addresses are wrapped in brackets
    ];

    if (privateRanges.some((range) => range.test(hostname))) {
      return err({
        type: "URL_NOT_PERMITTED" as const,
        message: "Access to private IP addresses is not permitted",
      });
    }

    // Restrict port numbers (block uncommon ports)
    const port = parsedUrl.port;
    if (port && !["80", "443", "8080", "8443"].includes(port)) {
      return err({
        type: "URL_NOT_PERMITTED" as const,
        message: "Access to this port is not permitted",
      });
    }

    return ok(parsedUrl);
  });
}
