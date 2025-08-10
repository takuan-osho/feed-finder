import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch for testing
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import the actual implementation functions
import {
  extractAttributeValue,
  findMetaFeeds,
  normalizeUrl,
  parseRequestBody,
  validateTargetUrl,
} from "./index";

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

  describe("extractAttributeValue", () => {
    it("should extract attribute values with normal spacing", () => {
      const tag =
        '<link rel="alternate" type="application/rss+xml" href="https://example.com/feed">';

      expect(extractAttributeValue(tag, "rel")).toBe("alternate");
      expect(extractAttributeValue(tag, "type")).toBe("application/rss+xml");
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed",
      );
    });

    it("should handle whitespace around equal signs", () => {
      const tag =
        '<link rel = "alternate" type= "application/rss+xml" href ="https://example.com/feed">';

      expect(extractAttributeValue(tag, "rel")).toBe("alternate");
      expect(extractAttributeValue(tag, "type")).toBe("application/rss+xml");
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed",
      );
    });

    it("should handle tabs around equal signs", () => {
      const tag =
        '<link rel\t=\t"alternate" type=\t"application/rss+xml" href\t="https://example.com/feed">';

      expect(extractAttributeValue(tag, "rel")).toBe("alternate");
      expect(extractAttributeValue(tag, "type")).toBe("application/rss+xml");
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed",
      );
    });

    it("should handle mixed spaces and tabs", () => {
      const tag =
        '<link rel \t= \t"alternate" type \t=\t "application/rss+xml">';

      expect(extractAttributeValue(tag, "rel")).toBe("alternate");
      expect(extractAttributeValue(tag, "type")).toBe("application/rss+xml");
    });

    it("should handle single quotes", () => {
      const tag =
        "<link rel = 'alternate' type= 'application/rss+xml' href ='https://example.com/feed'>";

      expect(extractAttributeValue(tag, "rel")).toBe("alternate");
      expect(extractAttributeValue(tag, "type")).toBe("application/rss+xml");
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed",
      );
    });

    it("should handle case insensitive attribute names", () => {
      const tag =
        '<link REL="alternate" TYPE="application/rss+xml" HREF="https://example.com/feed">';

      expect(extractAttributeValue(tag, "rel")).toBe("alternate");
      expect(extractAttributeValue(tag, "type")).toBe("application/rss+xml");
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed",
      );
    });

    it("should return null for non-existent attributes", () => {
      const tag = '<link rel="alternate" type="application/rss+xml">';

      expect(extractAttributeValue(tag, "href")).toBe(null);
      expect(extractAttributeValue(tag, "title")).toBe(null);
      expect(extractAttributeValue(tag, "nonexistent")).toBe(null);
    });

    it("should return null for malformed attributes without quotes", () => {
      const tag = "<link rel=alternate type=application/rss+xml>";

      expect(extractAttributeValue(tag, "rel")).toBe(null);
      expect(extractAttributeValue(tag, "type")).toBe(null);
    });

    it("should return null when equal sign is missing", () => {
      const tag = '<link rel "alternate" type="application/rss+xml">';

      expect(extractAttributeValue(tag, "rel")).toBe(null);
    });

    it("should handle empty attribute values", () => {
      const tag = '<link rel="" type="application/rss+xml">';

      expect(extractAttributeValue(tag, "rel")).toBe("");
      expect(extractAttributeValue(tag, "type")).toBe("application/rss+xml");
    });
  });

  describe("findMetaFeeds - MIME Type Case Sensitivity", () => {
    it("should detect feeds with lowercase MIME types", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">
            <link rel="alternate" type="application/atom+xml" href="/atom.xml" title="Atom Feed">
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";

      const feeds = findMetaFeeds(html, baseUrl);
      expect(feeds).toHaveLength(2);
      expect(feeds[0].type).toBe("RSS");
      expect(feeds[1].type).toBe("Atom");
    });

    it("should detect feeds with uppercase MIME types", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="APPLICATION/RSS+XML" href="/feed.xml" title="RSS Feed">
            <link rel="alternate" type="APPLICATION/ATOM+XML" href="/atom.xml" title="Atom Feed">
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";

      const feeds = findMetaFeeds(html, baseUrl);
      expect(feeds).toHaveLength(2);
      expect(feeds[0].type).toBe("RSS");
      expect(feeds[1].type).toBe("Atom");
    });

    it("should detect feeds with mixed case MIME types", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="Application/Rss+Xml" href="/feed.xml" title="RSS Feed">
            <link rel="alternate" type="Application/Atom+Xml" href="/atom.xml" title="Atom Feed">
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";

      const feeds = findMetaFeeds(html, baseUrl);
      expect(feeds).toHaveLength(2);
      expect(feeds[0].type).toBe("RSS");
      expect(feeds[1].type).toBe("Atom");
    });

    it("should detect feeds with application/xml MIME type", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/xml" href="/feed.xml" title="XML Feed">
            <link rel="alternate" type="APPLICATION/XML" href="/feed2.xml" title="XML Feed 2">
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";

      const feeds = findMetaFeeds(html, baseUrl);
      expect(feeds).toHaveLength(2);
      expect(feeds[0].type).toBe("RSS"); // Default for generic XML
      expect(feeds[1].type).toBe("RSS"); // Default for generic XML
    });

    it("should detect feeds with application/xml and charset parameter", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/xml; charset=UTF-8" href="/feed.xml" title="XML Feed">
            <link rel="alternate" type="text/xml; charset=utf-8" href="/feed2.xml" title="XML Feed 2">
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";

      const feeds = findMetaFeeds(html, baseUrl);
      expect(feeds).toHaveLength(2);
      expect(feeds[0].type).toBe("RSS");
      expect(feeds[1].type).toBe("RSS");
    });
  });
});
