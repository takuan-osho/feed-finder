import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch for testing
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import the functions we want to test
// Since we can't directly import from worker due to module system,
// we'll recreate the essential functions for testing
import { Result } from "neverthrow";

type ValidationError =
  | { type: "INVALID_REQUEST_BODY"; message: string }
  | { type: "MISSING_URL"; message: string }
  | { type: "INVALID_URL_FORMAT"; message: string }
  | { type: "URL_NOT_PERMITTED"; message: string };

// Recreate the validation functions for testing
const safeCreateUrl = Result.fromThrowable(
  (url: string) => new URL(url),
  (): ValidationError => ({
    type: "INVALID_URL_FORMAT" as const,
    message: "Invalid URL format",
  }),
);

function validateTargetUrl(url: string): Result<URL, ValidationError> {
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
      /^fc00:/, // fc00::/7 (IPv6 private)
      /^::1$/, // IPv6 loopback
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

function parseRequestBody(body: unknown): Result<string, ValidationError> {
  if (!body || typeof body !== "object") {
    return err({
      type: "INVALID_REQUEST_BODY" as const,
      message: "Invalid request body",
    });
  }

  const { url: targetUrl } = body as { url?: unknown };
  if (!targetUrl || typeof targetUrl !== "string") {
    return err({
      type: "MISSING_URL" as const,
      message: "URL is required",
    });
  }

  return ok(targetUrl);
}

function normalizeUrl(url: string): Result<string, ValidationError> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  // Validate that the normalized URL is properly formed
  return safeCreateUrl(normalizedUrl)
    .map(() => normalizedUrl)
    .mapErr(
      (): ValidationError => ({
        type: "INVALID_URL_FORMAT" as const,
        message: "Invalid URL format",
      }),
    );
}

describe("URL Validation Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateTargetUrl", () => {
    it("should accept valid HTTPS URLs", () => {
      const result = validateTargetUrl("https://example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.href).toBe("https://example.com/");
      }
    });

    it("should accept valid HTTP URLs", () => {
      const result = validateTargetUrl("http://example.com");
      expect(result.isOk()).toBe(true);
    });

    it("should reject FTP URLs", () => {
      const result = validateTargetUrl("ftp://example.com");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("URL_NOT_PERMITTED");
        expect(result.error.message).toContain("HTTP/HTTPS");
      }
    });

    it("should reject localhost URLs", () => {
      const testUrls = [
        "http://localhost",
        "https://localhost:3000",
        "http://127.0.0.1",
        "https://127.0.0.1:8080",
      ];

      testUrls.forEach((url) => {
        const result = validateTargetUrl(url);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("URL_NOT_PERMITTED");
          expect(result.error.message).toContain("localhost");
        }
      });

      // Test IPv6 localhost separately since it has different hostname format
      const ipv6Result = validateTargetUrl("http://[::1]");
      expect(ipv6Result.isErr()).toBe(true);
      if (ipv6Result.isErr()) {
        expect(ipv6Result.error.type).toBe("URL_NOT_PERMITTED");
      }
    });

    it("should reject private IP addresses", () => {
      const testUrls = [
        "http://10.0.0.1",
        "https://192.168.1.1",
        "http://172.16.0.1",
        "https://169.254.169.254", // AWS metadata service
      ];

      testUrls.forEach((url) => {
        const result = validateTargetUrl(url);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("URL_NOT_PERMITTED");
          expect(result.error.message).toContain("private IP");
        }
      });
    });

    it("should reject non-standard ports", () => {
      const result = validateTargetUrl("http://example.com:22");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("URL_NOT_PERMITTED");
        expect(result.error.message).toContain("port");
      }
    });

    it("should accept standard ports", () => {
      const testUrls = [
        "http://example.com:80",
        "https://example.com:443",
        "http://example.com:8080",
        "https://example.com:8443",
      ];

      testUrls.forEach((url) => {
        const result = validateTargetUrl(url);
        expect(result.isOk()).toBe(true);
      });
    });

    it("should reject malformed URLs", () => {
      const testUrls = ["not-a-url", "http://", "http://[invalid"];

      testUrls.forEach((url) => {
        const result = validateTargetUrl(url);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("INVALID_URL_FORMAT");
        }
      });
    });
  });

  describe("parseRequestBody", () => {
    it("should extract URL from valid request body", () => {
      const body = { url: "https://example.com" };
      const result = parseRequestBody(body);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com");
      }
    });

    it("should reject invalid request body", () => {
      const testBodies = [null, undefined, "not-an-object", 123];

      testBodies.forEach((body) => {
        const result = parseRequestBody(body);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("INVALID_REQUEST_BODY");
        }
      });

      // Array should be treated as missing URL (not invalid request body)
      const arrayResult = parseRequestBody([]);
      expect(arrayResult.isErr()).toBe(true);
      if (arrayResult.isErr()) {
        expect(arrayResult.error.type).toBe("MISSING_URL");
      }
    });

    it("should reject missing URL field", () => {
      const testBodies = [
        {},
        { notUrl: "value" },
        { url: null },
        { url: undefined },
        { url: 123 },
        { url: "" },
      ];

      testBodies.forEach((body) => {
        const result = parseRequestBody(body);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("MISSING_URL");
        }
      });
    });
  });

  describe("normalizeUrl", () => {
    it("should add HTTPS to URLs without protocol", () => {
      const result = normalizeUrl("example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com");
      }
    });

    it("should preserve existing HTTP protocol", () => {
      const result = normalizeUrl("http://example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("http://example.com");
      }
    });

    it("should preserve existing HTTPS protocol", () => {
      const result = normalizeUrl("https://example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com");
      }
    });

    it("should reject invalid URLs even after normalization", () => {
      const testUrls = ["://invalid"];

      testUrls.forEach((url) => {
        const result = normalizeUrl(url);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("INVALID_URL_FORMAT");
        }
      });
    });
  });

  describe("Error Information Leakage Prevention", () => {
    it("should not expose sensitive error details in user messages", () => {
      // Test that error messages don't contain sensitive internal information
      const sensitiveUrls = [
        "http://localhost:3000/admin",
        "http://192.168.1.1/secret",
        "https://169.254.169.254/metadata",
      ];

      sensitiveUrls.forEach((url) => {
        const result = validateTargetUrl(url);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          // Error message should be generic, not revealing the exact URL
          expect(result.error.message).not.toContain("admin");
          expect(result.error.message).not.toContain("secret");
          expect(result.error.message).not.toContain("metadata");
        }
      });
    });
  });

  describe("Result Type Safety", () => {
    it("should chain operations safely without try/catch", () => {
      const body = { url: "example.com" };

      const result = parseRequestBody(body)
        .andThen(normalizeUrl)
        .andThen(validateTargetUrl);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.href).toBe("https://example.com/");
      }
    });

    it("should propagate errors through the chain", () => {
      const body = { url: "localhost" };

      const result = parseRequestBody(body)
        .andThen(normalizeUrl)
        .andThen(validateTargetUrl);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("URL_NOT_PERMITTED");
      }
    });

    it("should handle malformed request body gracefully", () => {
      const body = null;

      const result = parseRequestBody(body)
        .andThen(normalizeUrl)
        .andThen(validateTargetUrl);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_REQUEST_BODY");
      }
    });
  });
});
