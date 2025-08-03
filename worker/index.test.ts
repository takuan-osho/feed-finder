import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch for testing
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import the actual implementation functions
import { normalizeUrl, parseRequestBody, validateTargetUrl } from "./index";

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
