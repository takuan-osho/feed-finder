import { beforeEach, describe, expect, it, vi } from "vitest";

import { discoverFeeds } from "./index";

// Mock dependencies
vi.mock("../validation/url", () => ({
  validateTargetUrl: vi.fn(),
}));

vi.mock("../net/fetch", () => ({
  fetchText: vi.fn(),
}));

vi.mock("./html", () => ({
  findMetaFeeds: vi.fn(),
}));

vi.mock("./commonPaths", () => ({
  tryCommonPaths: vi.fn(),
}));

import { err, errAsync, ok, okAsync, ResultAsync } from "neverthrow";

import { fetchText } from "../net/fetch";
import { validateTargetUrl } from "../validation/url";
import { tryCommonPaths } from "./commonPaths";
import { findMetaFeeds } from "./html";

const mockValidateTargetUrl = vi.mocked(validateTargetUrl);
const mockFetchText = vi.mocked(fetchText);
const mockFindMetaFeeds = vi.mocked(findMetaFeeds);
const mockTryCommonPaths = vi.mocked(tryCommonPaths);

describe("discovery/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("discoverFeeds", () => {
    const validUrl = new URL("https://example.com");
    it("should successfully discover feeds from both HTML and common paths", async () => {
      // Mock validation success
      mockValidateTargetUrl.mockReturnValue(ok(validUrl));

      // Mock successful bounded HTML fetch
      mockFetchText.mockReturnValue(okAsync("<html></html>"));

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
      expect(mockFetchText).toHaveBeenCalledWith("https://example.com/");
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
      mockFetchText.mockReturnValue(errAsync(fetchError));

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
      mockFetchText.mockReturnValue(okAsync("<html></html>"));

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

    it.each([
      { type: "PARSING_ERROR" as const, message: "Failed to read body" },
      { type: "TIMEOUT_ERROR" as const, message: "Timed out reading body" },
    ])("should fall back to common paths on body $type", async (bodyError) => {
      mockValidateTargetUrl.mockReturnValue(ok(validUrl));

      // Mock successful fetch but reading the body fails
      mockFetchText.mockReturnValue(errAsync(bodyError));

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

      expect(mockFindMetaFeeds).not.toHaveBeenCalled(); // Should not be called due to body read error
    });

    it("should skip meta-tag parsing for non-text responses", async () => {
      mockValidateTargetUrl.mockReturnValue(ok(validUrl));
      // fetchText returns null when Content-Type is clearly not text
      mockFetchText.mockReturnValue(okAsync(null));

      const commonFeeds = [
        {
          url: "https://example.com/feed.xml",
          title: "/feed feed",
          type: "RSS" as const,
          discoveryMethod: "common-path" as const,
        },
      ];
      mockTryCommonPaths.mockReturnValue(okAsync(commonFeeds));

      const result = await discoverFeeds("https://example.com");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(commonFeeds);
      }
      expect(mockFindMetaFeeds).not.toHaveBeenCalled();
      expect(mockTryCommonPaths).toHaveBeenCalledTimes(1); // no fallback needed
    });

    it("should return empty array when all discovery methods fail", async () => {
      mockValidateTargetUrl.mockReturnValue(ok(validUrl));

      // Mock HTML fetch failure
      const fetchError = {
        type: "NETWORK_ERROR" as const,
        message: "Network failed",
      };
      mockFetchText.mockReturnValue(errAsync(fetchError));

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
