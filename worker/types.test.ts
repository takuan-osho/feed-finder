import { describe, expect, it } from "vitest";
import type {
  AppError,
  FeedDiscoveryError,
  FeedResult,
  ValidationError,
} from "./types";

describe("types", () => {
  describe("ValidationError", () => {
    it("should support INVALID_REQUEST_BODY type", () => {
      const error: ValidationError = {
        type: "INVALID_REQUEST_BODY",
        message: "Invalid request body",
      };
      expect(error.type).toBe("INVALID_REQUEST_BODY");
      expect(error.message).toBe("Invalid request body");
    });

    it("should support MISSING_URL type", () => {
      const error: ValidationError = {
        type: "MISSING_URL",
        message: "URL is required",
      };
      expect(error.type).toBe("MISSING_URL");
      expect(error.message).toBe("URL is required");
    });

    it("should support INVALID_URL_FORMAT type", () => {
      const error: ValidationError = {
        type: "INVALID_URL_FORMAT",
        message: "Invalid URL format",
      };
      expect(error.type).toBe("INVALID_URL_FORMAT");
      expect(error.message).toBe("Invalid URL format");
    });

    it("should support URL_NOT_PERMITTED type", () => {
      const error: ValidationError = {
        type: "URL_NOT_PERMITTED",
        message: "Access to this URL is not permitted",
      };
      expect(error.type).toBe("URL_NOT_PERMITTED");
      expect(error.message).toBe("Access to this URL is not permitted");
    });
  });

  describe("FeedDiscoveryError", () => {
    it("should support FETCH_FAILED type with optional status", () => {
      const errorWithStatus: FeedDiscoveryError = {
        type: "FETCH_FAILED",
        message: "HTTP 404",
        status: 404,
      };
      expect(errorWithStatus.type).toBe("FETCH_FAILED");
      expect(errorWithStatus.message).toBe("HTTP 404");
      expect(errorWithStatus.status).toBe(404);

      const errorWithoutStatus: FeedDiscoveryError = {
        type: "FETCH_FAILED",
        message: "HTTP 502",
      };
      expect(errorWithoutStatus.type).toBe("FETCH_FAILED");
      expect(errorWithoutStatus.message).toBe("HTTP 502");
      expect(errorWithoutStatus.status).toBeUndefined();
    });

    it("should support NETWORK_ERROR type", () => {
      const error: FeedDiscoveryError = {
        type: "NETWORK_ERROR",
        message: "Connection refused",
      };
      expect(error.type).toBe("NETWORK_ERROR");
      expect(error.message).toBe("Connection refused");
    });

    it("should support TIMEOUT_ERROR type", () => {
      const error: FeedDiscoveryError = {
        type: "TIMEOUT_ERROR",
        message: "Request timeout",
      };
      expect(error.type).toBe("TIMEOUT_ERROR");
      expect(error.message).toBe("Request timeout");
    });

    it("should support PARSING_ERROR type", () => {
      const error: FeedDiscoveryError = {
        type: "PARSING_ERROR",
        message: "Failed to parse HTML",
      };
      expect(error.type).toBe("PARSING_ERROR");
      expect(error.message).toBe("Failed to parse HTML");
    });
  });

  describe("AppError", () => {
    it("should be a union of ValidationError and FeedDiscoveryError", () => {
      const validationError: AppError = {
        type: "INVALID_REQUEST_BODY",
        message: "Invalid body",
      };
      expect(validationError.type).toBe("INVALID_REQUEST_BODY");

      const discoveryError: AppError = {
        type: "NETWORK_ERROR",
        message: "Network failed",
      };
      expect(discoveryError.type).toBe("NETWORK_ERROR");
    });
  });

  describe("FeedResult", () => {
    it("should support RSS feed with required fields", () => {
      const feed: FeedResult = {
        url: "https://example.com/feed.rss",
        title: "Example RSS Feed",
        type: "RSS",
        discoveryMethod: "meta-tag",
      };
      expect(feed.url).toBe("https://example.com/feed.rss");
      expect(feed.title).toBe("Example RSS Feed");
      expect(feed.type).toBe("RSS");
      expect(feed.discoveryMethod).toBe("meta-tag");
      expect(feed.description).toBeUndefined();
    });

    it("should support Atom feed with optional description", () => {
      const feed: FeedResult = {
        url: "https://example.com/atom.xml",
        title: "Example Atom Feed",
        type: "Atom",
        description: "A sample Atom feed",
        discoveryMethod: "common-path",
      };
      expect(feed.url).toBe("https://example.com/atom.xml");
      expect(feed.title).toBe("Example Atom Feed");
      expect(feed.type).toBe("Atom");
      expect(feed.description).toBe("A sample Atom feed");
      expect(feed.discoveryMethod).toBe("common-path");
    });

    it("should only allow RSS or Atom type", () => {
      const rssResult: FeedResult = {
        url: "https://example.com/rss.xml",
        title: "RSS Feed",
        type: "RSS",
        discoveryMethod: "meta-tag",
      };
      expect(rssResult.type).toBe("RSS");

      const atomResult: FeedResult = {
        url: "https://example.com/atom.xml",
        title: "Atom Feed",
        type: "Atom",
        discoveryMethod: "common-path",
      };
      expect(atomResult.type).toBe("Atom");
    });

    it("should only allow meta-tag or common-path discovery method", () => {
      const metaTagResult: FeedResult = {
        url: "https://example.com/feed.xml",
        title: "Meta Tag Feed",
        type: "RSS",
        discoveryMethod: "meta-tag",
      };
      expect(metaTagResult.discoveryMethod).toBe("meta-tag");

      const commonPathResult: FeedResult = {
        url: "https://example.com/feed.xml",
        title: "Common Path Feed",
        type: "RSS",
        discoveryMethod: "common-path",
      };
      expect(commonPathResult.discoveryMethod).toBe("common-path");
    });
  });
});
