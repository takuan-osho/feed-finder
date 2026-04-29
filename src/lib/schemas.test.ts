import { describe, expect, it, vi } from "vitest";
import {
  ApiErrorSchema,
  FeedResultSchema,
  parseApiError,
  parseSearchResult,
  SearchResultSchema,
} from "./schemas";

describe("FeedResultSchema", () => {
  it("should validate a valid FeedResult with all fields", () => {
    const feedResult = {
      url: "https://example.com/feed.xml",
      title: "Example Feed",
      type: "RSS",
      description: "An example feed",
      discoveryMethod: "meta-tag",
    };

    const result = FeedResultSchema.safeParse(feedResult);
    expect(result.success).toBe(true);
  });

  it("should validate a valid FeedResult with only required fields", () => {
    const feedResult = {
      url: "https://example.com/feed.xml",
      type: "Atom",
      discoveryMethod: "common-path",
    };

    const result = FeedResultSchema.safeParse(feedResult);
    expect(result.success).toBe(true);
  });

  it("should reject invalid URL", () => {
    const feedResult = {
      url: "not-a-valid-url",
      type: "RSS",
      discoveryMethod: "meta-tag",
    };

    const result = FeedResultSchema.safeParse(feedResult);
    expect(result.success).toBe(false);
  });

  it("should reject invalid feed type", () => {
    const feedResult = {
      url: "https://example.com/feed.xml",
      type: "JSON" as const,
      discoveryMethod: "meta-tag",
    };

    const result = FeedResultSchema.safeParse(feedResult);
    expect(result.success).toBe(false);
  });

  it("should reject invalid discovery method", () => {
    const feedResult = {
      url: "https://example.com/feed.xml",
      type: "RSS",
      discoveryMethod: "unknown" as const,
    };

    const result = FeedResultSchema.safeParse(feedResult);
    expect(result.success).toBe(false);
  });
});

describe("SearchResultSchema", () => {
  it("should validate a valid SearchResult with feeds", () => {
    const searchResult = {
      success: true,
      feeds: [
        {
          url: "https://example.com/feed.xml",
          title: "Example Feed",
          type: "RSS",
          discoveryMethod: "meta-tag",
        },
      ],
      searchedUrl: "https://example.com",
      totalFound: 1,
    };

    const result = SearchResultSchema.safeParse(searchResult);
    expect(result.success).toBe(true);
  });

  it("should validate a valid SearchResult with no feeds", () => {
    const searchResult = {
      success: true,
      feeds: [],
      searchedUrl: "https://example.com",
      totalFound: 0,
      message: "No feeds found",
    };

    const result = SearchResultSchema.safeParse(searchResult);
    expect(result.success).toBe(true);
  });

  it("should reject negative totalFound", () => {
    const searchResult = {
      success: true,
      feeds: [],
      searchedUrl: "https://example.com",
      totalFound: -1,
    };

    const result = SearchResultSchema.safeParse(searchResult);
    expect(result.success).toBe(false);
  });

  it("should reject missing required fields", () => {
    const searchResult = {
      success: true,
      feeds: [],
    };

    const result = SearchResultSchema.safeParse(searchResult);
    expect(result.success).toBe(false);
  });
});

describe("ApiErrorSchema", () => {
  it("should validate a valid API error", () => {
    const apiError = {
      error: "Something went wrong",
    };

    const result = ApiErrorSchema.safeParse(apiError);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.error).toBe("Something went wrong");
    }
  });

  it("should reject missing error field", () => {
    const apiError = {
      message: "Wrong field name",
    };

    const result = ApiErrorSchema.safeParse(apiError);
    expect(result.success).toBe(false);
  });
});

describe("parseSearchResult", () => {
  it("should return parsed data for valid input", () => {
    const validData = {
      success: true,
      feeds: [
        {
          url: "https://example.com/feed.xml",
          type: "RSS",
          discoveryMethod: "meta-tag",
        },
      ],
      searchedUrl: "https://example.com",
      totalFound: 1,
    };

    const result = parseSearchResult(validData);
    expect(result.success).toBe(true);
    expect(result.feeds).toHaveLength(1);
  });

  it("should throw error for invalid input", () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const invalidData = {
      success: "not-a-boolean",
      feeds: [],
    };

    expect(() => parseSearchResult(invalidData)).toThrow(
      "The server returned a response in an unexpected format",
    );
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should throw error for null input", () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(() => parseSearchResult(null)).toThrow(
      "The server returned a response in an unexpected format",
    );
    consoleSpy.mockRestore();
  });
});

describe("parseApiError", () => {
  it("should return error message from valid API error", () => {
    const apiError = {
      error: "Rate limit exceeded",
    };

    const result = parseApiError(apiError);
    expect(result).toBe("Rate limit exceeded");
  });

  it("should return fallback message for invalid error format", () => {
    const invalidError = {
      message: "Wrong format",
    };

    const result = parseApiError(invalidError);
    expect(result).toBe("An unexpected error occurred");
  });

  it("should return fallback message for null", () => {
    const result = parseApiError(null);
    expect(result).toBe("An unexpected error occurred");
  });

  it("should return fallback message for undefined", () => {
    const result = parseApiError(undefined);
    expect(result).toBe("An unexpected error occurred");
  });
});
