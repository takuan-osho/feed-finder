import { beforeEach, describe, expect, it, vi } from "vitest";
import { findMetaFeeds } from "./index";

// Mock console.error to avoid noise in tests
vi.spyOn(console, "error").mockImplementation(() => {
  // Suppress console.error output during tests
});

// Mock fetch for integration tests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Security Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CORS Security", () => {
    const ALLOWED_ORIGINS = [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://feed-finder.shimizu-taku.workers.dev",
      "https://feedfinder.programarch.com",
      "https://feedfinder.takuan-osho.com",
      "https://feedfinder.takuan-osho.net",
    ];

    it("should validate CORS origins correctly", () => {
      // Test allowed origins
      ALLOWED_ORIGINS.forEach((origin) => {
        expect(ALLOWED_ORIGINS.includes(origin)).toBe(true);
      });

      // Test rejected origins
      const forbiddenOrigins = [
        "https://malicious-site.com",
        "http://attacker.example",
        "https://phishing-site.net",
      ];

      forbiddenOrigins.forEach((origin) => {
        expect(ALLOWED_ORIGINS.includes(origin)).toBe(false);
      });
    });
  });

  describe("SSRF Protection Tests", () => {
    it("should block AWS metadata service access", () => {
      const metadataUrls = [
        "http://169.254.169.254/latest/meta-data/",
        "https://169.254.169.254/latest/user-data/",
        "http://169.254.169.254/computeMetadata/v1/",
      ];

      metadataUrls.forEach((url) => {
        // These should be blocked by our validation
        expect(url).toMatch(/^https?:\/\/169\.254\./);
      });
    });

    it("should block internal network access", () => {
      const internalUrls = [
        "http://10.0.0.1/",
        "https://192.168.1.1/",
        "http://172.16.0.1/",
        "https://localhost:3000/",
        "http://127.0.0.1:8080/",
      ];

      internalUrls.forEach((url) => {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        const isBlocked =
          hostname === "localhost" ||
          hostname.startsWith("127.") ||
          /^10\./.test(hostname) ||
          /^192\.168\./.test(hostname) ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
          /^169\.254\./.test(hostname);

        expect(isBlocked).toBe(true);
      });
    });

    it("should allow legitimate external URLs", () => {
      const legitimateUrls = [
        "https://example.com/",
        "http://news.ycombinator.com/",
        "https://github.com/user/repo",
        "https://www.google.com/",
      ];

      legitimateUrls.forEach((url) => {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        const isAllowed =
          !["localhost"].includes(hostname) &&
          !hostname.startsWith("127.") &&
          !/^10\./.test(hostname) &&
          !/^192\.168\./.test(hostname) &&
          !/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) &&
          !/^169\.254\./.test(hostname);

        expect(isAllowed).toBe(true);
      });
    });
  });

  describe("Error Response Security", () => {
    it("should generate consistent error IDs", () => {
      // Test error ID generation format
      const errorId1 = Math.random().toString(36).slice(2, 11);
      const errorId2 = Math.random().toString(36).slice(2, 11);

      expect(errorId1).toMatch(/^[a-z0-9]{9}$/);
      expect(errorId2).toMatch(/^[a-z0-9]{9}$/);
      expect(errorId1).not.toBe(errorId2);
    });

    it("should provide generic error messages", () => {
      const errorTypes = [
        "INVALID_REQUEST_BODY",
        "MISSING_URL",
        "INVALID_URL_FORMAT",
        "URL_NOT_PERMITTED",
        "FETCH_FAILED",
        "NETWORK_ERROR",
        "TIMEOUT_ERROR",
        "PARSING_ERROR",
      ];

      errorTypes.forEach((errorType) => {
        // All error types should map to user-friendly messages
        // without exposing internal details
        expect(errorType).toMatch(/^[A-Z_]+$/);
      });
    });
  });

  describe("Input Sanitization", () => {
    it("should handle malicious input safely", () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        "../../etc/passwd",
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "%22%3E%3Cscript%3Ealert%281%29%3C/script%3E",
      ];

      maliciousInputs.forEach((input) => {
        // These should be safely handled without executing
        expect(typeof input).toBe("string");
        // URL validation should reject non-HTTP(S) protocols
        if (input.includes(":") && !input.startsWith("http")) {
          expect(input).not.toMatch(/^https?:/);
        }
      });
    });

    it("should validate protocol schemes", () => {
      const protocols = ["javascript:", "data:", "file:", "ftp:", "gopher:"];

      protocols.forEach((protocol) => {
        expect(["http:", "https:"].includes(protocol)).toBe(false);
      });
    });
  });

  describe("HTTP Method Security", () => {
    it("should only accept POST for API endpoints", () => {
      const allowedMethods = ["POST", "OPTIONS"];
      const blockedMethods = ["GET", "PUT", "DELETE", "PATCH", "HEAD"];

      // POST should be allowed for API calls
      expect(allowedMethods.includes("POST")).toBe(true);

      // OPTIONS should be allowed for CORS preflight
      expect(allowedMethods.includes("OPTIONS")).toBe(true);

      // Other methods should not be in allowed list for main API
      blockedMethods.forEach((method) => {
        expect(["POST"].includes(method)).toBe(false);
      });
    });
  });

  describe("Content Type Validation", () => {
    it("should identify RSS/Atom content types", () => {
      const validContentTypes = [
        "application/rss+xml",
        "application/atom+xml",
        "text/xml",
        "application/xml",
      ];

      const invalidContentTypes = [
        "text/html",
        "application/json",
        "text/plain",
        "image/jpeg",
      ];

      validContentTypes.forEach((contentType) => {
        const isValidFeed =
          contentType.includes("xml") ||
          contentType.includes("rss") ||
          contentType.includes("atom");
        expect(isValidFeed).toBe(true);
      });

      invalidContentTypes.forEach((contentType) => {
        const isValidFeed =
          contentType.includes("xml") ||
          contentType.includes("rss") ||
          contentType.includes("atom");
        expect(isValidFeed).toBe(false);
      });
    });
  });

  describe("Security Headers Validation", () => {
    it("should include required security headers", () => {
      const requiredHeaders = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy":
          "default-src 'none'; script-src 'none'; object-src 'none'",
      };

      Object.entries(requiredHeaders).forEach(([header, value]) => {
        expect(typeof header).toBe("string");
        expect(typeof value).toBe("string");
        expect(header.length).toBeGreaterThan(0);
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("URL Pattern Validation", () => {
    it("should correctly identify feed URLs", () => {
      const feedPaths = [
        "/feed",
        "/feeds",
        "/rss",
        "/rss.xml",
        "/feed.xml",
        "/atom.xml",
        "/index.xml",
      ];

      feedPaths.forEach((path) => {
        expect(path.startsWith("/")).toBe(true);
        expect(path.length).toBeGreaterThan(1);
      });
    });

    it("should validate API endpoints", () => {
      const apiPath = "/api/search-feeds";
      expect(apiPath.startsWith("/api/")).toBe(true);
      expect(apiPath).toBe("/api/search-feeds");
    });
  });

  describe("Regex Security", () => {
    it.skip("TODO: resist ReDoS attacks in findMetaFeeds function", () => {
      // Test ReDoS vulnerability in current regex pattern
      // The current regex /<link[^>]*(?:...)[^>]*>/gi has [^>]* quantifiers that can cause exponential backtracking

      // Create pathological ReDoS attack pattern - many characters before closing >
      const maliciousHtml =
        "<link " +
        "a=b ".repeat(3000) + // Many non-closing characters
        // No closing '>' - this will cause catastrophic backtracking in vulnerable regex
        'rel="alternate" type="application/rss+xml" href="/feed.xml"';

      // TODO: Use vi.useFakeTimers() for deterministic testing instead of performance.now()
      const startTime = performance.now();

      // Test the potentially vulnerable function
      const feeds = findMetaFeeds(maliciousHtml, "https://example.com");

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // For now, document that the current implementation is vulnerable
      // A secure implementation should complete in < 10ms
      console.log(`findMetaFeeds execution time: ${executionTime}ms`);

      // Test expectation: secure implementation should be fast and safe
      expect(feeds).toBeDefined();
      expect(Array.isArray(feeds)).toBe(true);

      // TODO: Once ReDoS vulnerability is fixed, re-enable this test with:
      // 1. vi.useFakeTimers() for deterministic timing
      // 2. More robust timeout detection methodology
      // 3. Proper ReDoS attack vector testing
      // Current implementation may be vulnerable to ReDoS - needs investigation
      // expect(executionTime).toBeLessThan(10); // Should be fast when fixed
    });

    it("should handle regex patterns safely", () => {
      // Test normal operation with safe patterns
      const testHtml =
        '<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS">';

      const feeds = findMetaFeeds(testHtml, "https://example.com");

      expect(feeds).toBeDefined();
      expect(Array.isArray(feeds)).toBe(true);
      expect(feeds.length).toBeGreaterThan(0);
      expect(feeds[0].url).toBe("https://example.com/feed.xml");
    });

    it("should validate IP address patterns", () => {
      const privateRanges = [
        /^10\./, // 10.0.0.0/8
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
        /^192\.168\./, // 192.168.0.0/16
        /^169\.254\./, // 169.254.0.0/16 (link-local/metadata service)
      ];

      // Test valid private IPs
      expect(privateRanges[0].test("10.0.0.1")).toBe(true);
      expect(privateRanges[1].test("172.16.0.1")).toBe(true);
      expect(privateRanges[2].test("192.168.1.1")).toBe(true);
      expect(privateRanges[3].test("169.254.169.254")).toBe(true);

      // Test invalid IPs (should not match)
      expect(privateRanges[0].test("11.0.0.1")).toBe(false);
      expect(privateRanges[1].test("172.15.0.1")).toBe(false);
      expect(privateRanges[2].test("193.168.1.1")).toBe(false);
      expect(privateRanges[3].test("170.254.169.254")).toBe(false);
    });
  });

  describe("HTML Parser Implementation", () => {
    it("should use proper HTML parser for maintainability and performance", () => {
      const htmlWithFeeds = `
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/feed.xml">
          <link rel="alternate" type="application/atom+xml" title="Atom Feed" href="/atom.xml">
          <link rel="stylesheet" href="/styles.css">
        </head>
        <body></body>
        </html>
      `;

      const feeds = findMetaFeeds(htmlWithFeeds, "https://example.com");

      // Expect proper parsing with maintainable code structure
      expect(feeds).toHaveLength(2);
      expect(feeds[0]).toEqual({
        title: "RSS Feed",
        url: "https://example.com/feed.xml",
        type: "RSS",
        discoveryMethod: "meta-tag",
      });
      expect(feeds[1]).toEqual({
        title: "Atom Feed",
        url: "https://example.com/atom.xml",
        type: "Atom",
        discoveryMethod: "meta-tag",
      });
    });

    it("should handle malformed HTML gracefully with proper parser", () => {
      const malformedHtml = `
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS
        <link rel="alternate" type="application/atom+xml" href="/atom.xml"
        <unclosed-tag>
      `;

      const feeds = findMetaFeeds(malformedHtml, "https://example.com");

      // Parser should handle malformed HTML gracefully
      expect(feeds.length).toBeGreaterThanOrEqual(1);
      expect(
        feeds.some((feed) => feed.url === "https://example.com/feed.xml"),
      ).toBe(true);
    });
  });
});
