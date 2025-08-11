import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch for testing
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { extractAttributeValue, findMetaFeeds } from "./discovery/html";
import { parseRequestBody, normalizeUrl } from "./validation/request";
// Import the actual implementation functions from their modular locations
import { validateTargetUrl } from "./validation/url";

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

    it("should detect feeds with uppercase link tags in fallback parsing", async () => {
      // Mock node-html-parser to force fallback parsing
      await vi.resetModules();
      vi.mock("node-html-parser", () => ({
        parse: vi.fn(() => {
          throw new Error("Parse failed");
        }),
      }));

      const htmlWithUppercaseTags = `<html><head>
      <LINK REL="alternate" TYPE="application/rss+xml" HREF="/feed.xml" TITLE="RSS Feed">
      <LINK REL="alternate" TYPE="application/atom+xml" HREF="/atom.xml" TITLE="Atom Feed">
      </head></html>`;
      const baseUrl = "https://example.com";

      // Dynamically import after module cache is cleared to apply mock
      const { findMetaFeeds: findMetaFeedsWithMock } = await import(
        "./discovery/html"
      );
      const feeds = findMetaFeedsWithMock(htmlWithUppercaseTags, baseUrl);
      expect(feeds).toHaveLength(2);
      expect(feeds[0].type).toBe("RSS");
      expect(feeds[1].type).toBe("Atom");

      vi.unmock("node-html-parser");
    });
  });
});

// Performance Optimization Tests (t-wada式TDD)
describe("Performance Optimization Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Parallel Processing Tests", () => {
    it("should execute common paths discovery in parallel (faster than sequential)", async () => {
      // Red Phase: This test should FAIL initially to demonstrate parallel processing works
      const baseUrl = "https://example.com";
      const mockResponse = new Response("", {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      });

      let requestCount = 0;
      const requestTimes: number[] = [];

      mockFetch.mockImplementation(() => {
        requestCount++;
        const startTime = performance.now();
        requestTimes.push(startTime);
        return Promise.resolve(mockResponse);
      });

      const startTime = performance.now();

      // Import function to test parallel execution
      const { default: worker } = await import("./index");

      // Create a mock request
      const request = new Request("https://test.com/api/search-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: baseUrl }),
      });

      await worker.fetch(request);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Test should verify parallel execution characteristics:
      // 1. Multiple requests were made (common paths)
      // 2. They executed in parallel (similar timing)
      expect(requestCount).toBeGreaterThan(1);

      // Parallel requests should have similar start times (within 10ms)
      if (requestTimes.length > 1) {
        const timeDifferences = requestTimes
          .slice(1)
          .map((time, i) => Math.abs(time - requestTimes[i]));
        const maxTimeDifference = Math.max(...timeDifferences);
        expect(maxTimeDifference).toBeLessThan(10); // Should be nearly simultaneous
      }

      // Total time should be reasonable for parallel execution
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should combine HTML fetch and common paths in parallel", async () => {
      // Red Phase: Test that both HTML parsing and common paths run concurrently
      const baseUrl = "https://example.com";
      const htmlContent = `<html><head>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">
      </head></html>`;

      const mockHtmlResponse = new Response(htmlContent, {
        status: 200,
        headers: { "content-type": "text/html" },
      });

      const mockFeedResponse = new Response("", {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      });

      let htmlRequestTime: number | null = null;
      let commonPathsRequestTime: number | null = null;

      mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
        const currentTime = performance.now();

        if (!options || options.method !== "HEAD") {
          // This is the HTML fetch request
          htmlRequestTime = currentTime;
          return Promise.resolve(mockHtmlResponse);
        } else {
          // This is a common path HEAD request
          if (commonPathsRequestTime === null) {
            commonPathsRequestTime = currentTime;
          }
          return Promise.resolve(mockFeedResponse.clone());
        }
      });

      const { default: worker } = await import("./index");
      const request = new Request("https://test.com/api/search-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: baseUrl }),
      });

      await worker.fetch(request);

      // Verify both types of requests occurred
      expect(htmlRequestTime).not.toBeNull();
      expect(commonPathsRequestTime).not.toBeNull();

      // They should execute in parallel (within 50ms of each other)
      if (htmlRequestTime && commonPathsRequestTime) {
        const timeDifference = Math.abs(
          htmlRequestTime - commonPathsRequestTime,
        );
        expect(timeDifference).toBeLessThan(50);
      }
    });
  });

  describe("Bundle Optimization Verification", () => {
    it("should have modular exports for code splitting", async () => {
      // Red Phase: Verify that key functions are exported for optimal bundling from their respective modules
      const urlValidation = await import("./validation/url");
      const requestValidation = await import("./validation/request");
      const htmlDiscovery = await import("./discovery/html");

      // These functions should be exported for optimal bundling
      expect(typeof urlValidation.validateTargetUrl).toBe("function");
      expect(typeof requestValidation.normalizeUrl).toBe("function");
      expect(typeof requestValidation.parseRequestBody).toBe("function");
      expect(typeof htmlDiscovery.findMetaFeeds).toBe("function");
      expect(typeof htmlDiscovery.extractAttributeValue).toBe("function");
    });
  });
});
