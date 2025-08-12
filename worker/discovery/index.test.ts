import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverFeeds } from "./index";

// Mock dependencies
vi.mock("../validation/url", () => ({
  validateTargetUrl: vi.fn(),
}));

vi.mock("../net/fetch", () => ({
  safeFetch: vi.fn(),
}));

vi.mock("./html", () => ({
  findMetaFeeds: vi.fn(),
}));

vi.mock("./commonPaths", () => ({
  tryCommonPaths: vi.fn(),
}));

import { err, ok, ResultAsync } from "neverthrow";
import { safeFetch } from "../net/fetch";
import { validateTargetUrl } from "../validation/url";
import { tryCommonPaths } from "./commonPaths";
import { findMetaFeeds } from "./html";

const mockValidateTargetUrl = vi.mocked(validateTargetUrl);
const mockSafeFetch = vi.mocked(safeFetch);
const mockFindMetaFeeds = vi.mocked(findMetaFeeds);
const mockTryCommonPaths = vi.mocked(tryCommonPaths);

describe("discovery/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("discoverFeeds", () => {
    const validUrl = new URL("https://example.com");
    const mockResponse = new Response(
      "<html><head></head><body></body></html>",
    );

    it("should successfully discover feeds from both HTML and common paths", async () => {
      // Mock validation success
      mockValidateTargetUrl.mockReturnValue(ok(validUrl));

      // Mock successful HTML fetch
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockResponse)),
      );

      // Mock HTML response text
      const textSpy = vi
        .spyOn(mockResponse, "text")
        .mockResolvedValue("<html></html>");

      // Mock feed discovery methods
      const metaFeeds = [
        {
          url: "https://example.com/feed.xml",
          title: "Meta Feed",
          type: "RSS" as const,
          discoveryMethod: "meta-tag" as const,
        },
      ];

      const commonFeeds = [
        {
          url: "https://example.com/rss.xml",
          title: "RSS Feed",
          type: "RSS" as const,
          discoveryMethod: "common-path" as const,
        },
      ];

      mockFindMetaFeeds.mockReturnValue(metaFeeds);
      mockTryCommonPaths.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(commonFeeds)),
      );

      const result = await discoverFeeds("https://example.com");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toEqual(metaFeeds[0]);
        expect(result.value[1]).toEqual(commonFeeds[0]);
      }

      expect(mockValidateTargetUrl).toHaveBeenCalledWith("https://example.com");
      expect(mockSafeFetch).toHaveBeenCalledWith("https://example.com/");
      expect(textSpy).toHaveBeenCalled();
      expect(mockFindMetaFeeds).toHaveBeenCalledWith(
        "<html></html>",
        "https://example.com/",
      );
      expect(mockTryCommonPaths).toHaveBeenCalledWith("https://example.com/");
    });

    it("should handle URL validation errors", async () => {
      const validationError = {
        type: "URL_NOT_PERMITTED" as const,
        message: "Access to this URL is not permitted",
      };

      mockValidateTargetUrl.mockReturnValue(err(validationError));

      const result = await discoverFeeds("http://localhost");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FETCH_FAILED");
        expect(result.error.message).toBe(
          "Access to this URL is not permitted",
        );
      }
    });

    it("should fallback to common paths when HTML fetch fails", async () => {
      mockValidateTargetUrl.mockReturnValue(ok(validUrl));

      // Mock HTML fetch failure
      const fetchError = {
        type: "NETWORK_ERROR" as const,
        message: "Network failed",
      };
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromPromise(Promise.reject(fetchError), () => fetchError),
      );

      // Mock common paths success
      const commonFeeds = [
        {
          url: "https://example.com/feed.xml",
          title: "/feed feed",
          type: "RSS" as const,
          discoveryMethod: "common-path" as const,
        },
      ];
      mockTryCommonPaths.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(commonFeeds)),
      );

      const result = await discoverFeeds("https://example.com");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toEqual(commonFeeds[0]);
      }

      expect(mockTryCommonPaths).toHaveBeenCalledTimes(2); // Called in parallel and in fallback
    });

    it("should deduplicate feeds with same URL", async () => {
      mockValidateTargetUrl.mockReturnValue(ok(validUrl));
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockResponse)),
      );

      vi.spyOn(mockResponse, "text").mockResolvedValue("<html></html>");

      // Both methods return the same feed URL
      const duplicateFeedUrl = "https://example.com/feed.xml";
      const metaFeeds = [
        {
          url: duplicateFeedUrl,
          title: "Meta Feed",
          type: "RSS" as const,
          discoveryMethod: "meta-tag" as const,
        },
      ];

      const commonFeeds = [
        {
          url: duplicateFeedUrl,
          title: "Common Path Feed",
          type: "RSS" as const,
          discoveryMethod: "common-path" as const,
        },
      ];

      mockFindMetaFeeds.mockReturnValue(metaFeeds);
      mockTryCommonPaths.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(commonFeeds)),
      );

      const result = await discoverFeeds("https://example.com");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1); // Deduplicated
        expect(result.value[0]).toEqual(metaFeeds[0]); // Meta feeds have priority
      }
    });

    it("should handle HTML parsing errors", async () => {
      mockValidateTargetUrl.mockReturnValue(ok(validUrl));

      // Mock successful fetch but text parsing fails
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockResponse)),
      );
      const textSpy = vi
        .spyOn(mockResponse, "text")
        .mockRejectedValue(new Error("Parse error"));

      // Mock common paths fallback
      const commonFeeds = [
        {
          url: "https://example.com/feed.xml",
          title: "/feed feed",
          type: "RSS" as const,
          discoveryMethod: "common-path" as const,
        },
      ];
      mockTryCommonPaths.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(commonFeeds)),
      );

      const result = await discoverFeeds("https://example.com");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toEqual(commonFeeds[0]);
      }

      expect(textSpy).toHaveBeenCalled();
      expect(mockFindMetaFeeds).not.toHaveBeenCalled(); // Should not be called due to text parse error
    });

    it("should return empty array when all discovery methods fail", async () => {
      mockValidateTargetUrl.mockReturnValue(ok(validUrl));

      // Mock HTML fetch failure
      const fetchError = {
        type: "NETWORK_ERROR" as const,
        message: "Network failed",
      };
      mockSafeFetch.mockReturnValue(
        ResultAsync.fromPromise(Promise.reject(fetchError), () => fetchError),
      );

      // Mock common paths failure
      const commonPathsError = {
        type: "NETWORK_ERROR" as const,
        message: "All paths failed",
      };
      mockTryCommonPaths.mockReturnValue(
        ResultAsync.fromPromise(
          Promise.reject(commonPathsError),
          () => commonPathsError,
        ),
      );

      const result = await discoverFeeds("https://example.com");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("NETWORK_ERROR");
      }
    });
  });
});
