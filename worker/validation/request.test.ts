import { describe, expect, it } from "vitest";
import { normalizeUrl, parseRequestBody } from "./request";

describe("validation/request", () => {
  describe("parseRequestBody", () => {
    it("should successfully parse valid request body with URL", () => {
      const body = { url: "https://example.com" };
      const result = parseRequestBody(body);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com");
      }
    });

    it("should fail for null body", () => {
      const result = parseRequestBody(null);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_REQUEST_BODY");
        expect(result.error.message).toBe("Invalid request body");
      }
    });

    it("should fail for undefined body", () => {
      const result = parseRequestBody(undefined);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_REQUEST_BODY");
        expect(result.error.message).toBe("Invalid request body");
      }
    });

    it("should fail for non-object body", () => {
      const result = parseRequestBody("invalid");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_REQUEST_BODY");
        expect(result.error.message).toBe("Invalid request body");
      }
    });

    it("should fail for body without url field", () => {
      const body = { notUrl: "value" };
      const result = parseRequestBody(body);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("MISSING_URL");
        expect(result.error.message).toBe("URL is required");
      }
    });

    it("should fail for body with null url", () => {
      const body = { url: null };
      const result = parseRequestBody(body);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("MISSING_URL");
        expect(result.error.message).toBe("URL is required");
      }
    });

    it("should fail for body with non-string url", () => {
      const body = { url: 123 };
      const result = parseRequestBody(body);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("MISSING_URL");
        expect(result.error.message).toBe("URL is required");
      }
    });

    it("should fail for body with empty url string", () => {
      const body = { url: "" };
      const result = parseRequestBody(body);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("MISSING_URL");
        expect(result.error.message).toBe("URL is required");
      }
    });
  });

  describe("normalizeUrl", () => {
    it("should keep HTTPS URLs as-is", () => {
      const result = normalizeUrl("https://example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com");
      }
    });

    it("should keep HTTP URLs as-is", () => {
      const result = normalizeUrl("http://example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("http://example.com");
      }
    });

    it("should add https:// prefix to URLs without protocol", () => {
      const result = normalizeUrl("example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com");
      }
    });

    it("should handle URLs with paths", () => {
      const result = normalizeUrl("example.com/path");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com/path");
      }
    });

    it("should handle URLs with query parameters", () => {
      const result = normalizeUrl("example.com?param=value");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com?param=value");
      }
    });

    it("should fail for invalid URL formats", () => {
      const invalidUrls = [
        "not a url",
        "ftp://example.com", // invalid after normalization
        "://example.com",
        "http:/",
        "",
      ];

      invalidUrls.forEach((invalidUrl) => {
        const result = normalizeUrl(invalidUrl);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("INVALID_URL_FORMAT");
          expect(result.error.message).toBe("Invalid URL format");
        }
      });
    });

    it("should handle subdomains", () => {
      const result = normalizeUrl("blog.example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://blog.example.com");
      }
    });

    it("should handle ports", () => {
      const result = normalizeUrl("example.com:8080");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com:8080");
      }
    });
  });
});
