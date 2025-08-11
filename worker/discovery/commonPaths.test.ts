import { err, ok, ResultAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tryCommonPaths } from "./commonPaths";

// Mock dependencies
vi.mock("../validation/url", () => ({
  validateTargetUrl: vi.fn(),
}));

vi.mock("../net/fetch", () => ({
  safeFetch: vi.fn(),
}));

import { safeFetch } from "../net/fetch";
import { validateTargetUrl } from "../validation/url";

const mockValidateTargetUrl = vi.mocked(validateTargetUrl);
const mockSafeFetch = vi.mocked(safeFetch);

describe("discovery/commonPaths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tryCommonPaths", () => {
    const baseUrl = "https://example.com";

    it("should discover feeds from common paths", async () => {
      const validUrl = new URL("https://example.com/feed");

      // Mock validation success for first path
      mockValidateTargetUrl
        .mockReturnValueOnce(ok(validUrl))
        .mockReturnValue(
          err({ type: "INVALID_URL_FORMAT", message: "Invalid" }),
        );

      // Mock successful HEAD request with RSS content type
      const mockResponse = new Response(null, {
        status: 200,
        headers: {
          "content-type": "application/rss+xml",
        },
      });
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockResponse)),
      );

      const result = await tryCommonPaths(baseUrl);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toEqual({
          url: "https://example.com/feed",
          title: "/feed feed",
          type: "RSS",
          discoveryMethod: "common-path",
        });
      }

      expect(mockSafeFetch).toHaveBeenCalledWith("https://example.com/feed", {
        method: "HEAD",
      });
    });

    it("should detect Atom feeds from content-type", async () => {
      const validUrl = new URL("https://example.com/atom.xml");
      mockValidateTargetUrl
        .mockReturnValueOnce(ok(validUrl))
        .mockReturnValue(
          err({ type: "INVALID_URL_FORMAT", message: "Invalid" }),
        );

      const mockResponse = new Response(null, {
        status: 200,
        headers: {
          "content-type": "application/atom+xml",
        },
      });
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockResponse)),
      );

      const result = await tryCommonPaths(baseUrl);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value[0].type).toBe("Atom");
      }
    });

    it("should try all common paths", async () => {
      const commonPaths = [
        "/feed",
        "/feeds",
        "/rss",
        "/rss.xml",
        "/feed.xml",
        "/atom.xml",
        "/index.xml",
      ];

      // Mock validation success for all paths
      commonPaths.forEach((path) => {
        const validUrl = new URL(`https://example.com${path}`);
        mockValidateTargetUrl.mockReturnValueOnce(ok(validUrl));
      });

      // Mock all HEAD requests to return valid RSS feeds
      const mockResponse = new Response(null, {
        status: 200,
        headers: {
          "content-type": "application/rss+xml",
        },
      });
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockResponse)),
      );

      const result = await tryCommonPaths(baseUrl);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(commonPaths.length);
      }

      // Verify all paths were tested
      commonPaths.forEach((path) => {
        expect(mockSafeFetch).toHaveBeenCalledWith(
          `https://example.com${path}`,
          { method: "HEAD" },
        );
      });
    });

    it("should filter out non-feed content types", async () => {
      const validUrl = new URL("https://example.com/feed");
      mockValidateTargetUrl
        .mockReturnValueOnce(ok(validUrl))
        .mockReturnValue(
          err({ type: "INVALID_URL_FORMAT", message: "Invalid" }),
        );

      // Mock response with HTML content type (not a feed)
      const mockResponse = new Response(null, {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      });
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockResponse)),
      );

      const result = await tryCommonPaths(baseUrl);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(0); // No feeds found
      }
    });

    it("should handle fetch failures gracefully", async () => {
      const validUrl = new URL("https://example.com/feed");
      mockValidateTargetUrl
        .mockReturnValueOnce(ok(validUrl))
        .mockReturnValue(
          err({ type: "INVALID_URL_FORMAT", message: "Invalid" }),
        );

      // Mock fetch failure
      const fetchError = {
        type: "NETWORK_ERROR" as const,
        message: "Connection failed",
      };
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromPromise(Promise.reject(fetchError), () => fetchError),
      );

      const result = await tryCommonPaths(baseUrl);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(0); // No feeds found due to fetch failure
      }
    });

    it("should handle invalid URLs gracefully", async () => {
      // Mock all URL validation to fail
      mockValidateTargetUrl.mockReturnValue(
        err({
          type: "INVALID_URL_FORMAT",
          message: "Invalid URL format",
        }),
      );

      const result = await tryCommonPaths(baseUrl);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(0); // No feeds found due to invalid URLs
      }

      expect(mockSafeFetch).not.toHaveBeenCalled(); // Should not fetch invalid URLs
    });

    it("should handle missing content-type header", async () => {
      const validUrl = new URL("https://example.com/feed");
      mockValidateTargetUrl
        .mockReturnValueOnce(ok(validUrl))
        .mockReturnValue(
          err({ type: "INVALID_URL_FORMAT", message: "Invalid" }),
        );

      // Mock response without content-type header
      const mockResponse = new Response(null, {
        status: 200,
        headers: {},
      });
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockResponse)),
      );

      const result = await tryCommonPaths(baseUrl);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(0); // No feeds found without content-type
      }
    });

    it("should handle XML content types correctly", async () => {
      const validUrl = new URL("https://example.com/feed.xml");
      mockValidateTargetUrl
        .mockReturnValueOnce(ok(validUrl))
        .mockReturnValue(
          err({ type: "INVALID_URL_FORMAT", message: "Invalid" }),
        );

      // Mock response with generic XML content type
      const mockResponse = new Response(null, {
        status: 200,
        headers: {
          "content-type": "text/xml; charset=utf-8",
        },
      });
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockResponse)),
      );

      const result = await tryCommonPaths(baseUrl);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].type).toBe("RSS"); // Default to RSS for XML
      }
    });

    it("should create appropriate feed titles based on paths", async () => {
      const paths = ["/feed", "/rss.xml", "/atom.xml"];

      paths.forEach((path) => {
        const validUrl = new URL(`https://example.com${path}`);
        mockValidateTargetUrl.mockReturnValueOnce(ok(validUrl));
      });

      // Add invalid validations for other paths
      mockValidateTargetUrl.mockReturnValue(
        err({ type: "INVALID_URL_FORMAT", message: "Invalid" }),
      );

      const mockResponse = new Response(null, {
        status: 200,
        headers: {
          "content-type": "application/rss+xml",
        },
      });
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockResponse)),
      );

      const result = await tryCommonPaths("https://example.com");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(paths.length);
        // Results might be in different order due to Promise.all
        const titles = result.value.map((feed) => feed.title).sort();
        expect(titles).toEqual(["/atom.xml feed", "/feed feed", "/rss.xml feed"].sort());
      }
    });
  });
});
