import { describe, expect, it } from "vitest";
import {
  ALLOWED_ORIGINS,
  DEFAULT_FEED_TITLE,
  FETCH_TIMEOUT_MS,
  MAX_LINK_TAG_LENGTH,
  SUPPORTED_FEED_TYPES,
  USER_AGENT,
} from "./config";

describe("config", () => {
  describe("DEFAULT_FEED_TITLE", () => {
    it("should provide a default title for feeds", () => {
      expect(DEFAULT_FEED_TITLE).toBe("RSS/Atom feed");
      expect(typeof DEFAULT_FEED_TITLE).toBe("string");
      expect(DEFAULT_FEED_TITLE.length).toBeGreaterThan(0);
    });
  });

  describe("SUPPORTED_FEED_TYPES", () => {
    it("should include all required RSS/Atom MIME types", () => {
      const expectedTypes = [
        "application/rss+xml",
        "application/atom+xml",
        "application/rdf+xml",
        "text/xml",
        "application/xml",
      ];

      expect(SUPPORTED_FEED_TYPES).toEqual(expectedTypes);
    });

    it("should contain only string values", () => {
      SUPPORTED_FEED_TYPES.forEach((type) => {
        expect(typeof type).toBe("string");
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it("should be read-only array", () => {
      expect(Array.isArray(SUPPORTED_FEED_TYPES)).toBe(true);
      expect(SUPPORTED_FEED_TYPES.length).toBe(5);
    });
  });

  describe("ALLOWED_ORIGINS", () => {
    it("should include development and production origins", () => {
      const expectedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://feedfinder.programarch.com",
        "https://feedfinder.takuan-osho.com",
        "https://feedfinder.takuan-osho.net",
      ];

      expect(ALLOWED_ORIGINS).toEqual(expectedOrigins);
    });

    it("should contain only valid HTTP/HTTPS URLs", () => {
      ALLOWED_ORIGINS.forEach((origin) => {
        expect(typeof origin).toBe("string");
        expect(
          origin.startsWith("http://") || origin.startsWith("https://"),
        ).toBe(true);
        expect(() => new URL(origin)).not.toThrow();
      });
    });

    it("should include localhost development origins", () => {
      expect(ALLOWED_ORIGINS).toContain("http://localhost:5173");
      expect(ALLOWED_ORIGINS).toContain("http://localhost:3000");
    });

    it("should include production domains", () => {
      const productionOrigins = ALLOWED_ORIGINS.filter((origin) =>
        origin.startsWith("https://"),
      );
      expect(productionOrigins.length).toBeGreaterThan(0);
    });
  });

  describe("MAX_LINK_TAG_LENGTH", () => {
    it("should be a positive integer", () => {
      expect(MAX_LINK_TAG_LENGTH).toBe(1000);
      expect(typeof MAX_LINK_TAG_LENGTH).toBe("number");
      expect(MAX_LINK_TAG_LENGTH).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_LINK_TAG_LENGTH)).toBe(true);
    });
  });

  describe("USER_AGENT", () => {
    it("should provide a proper User-Agent string", () => {
      expect(USER_AGENT).toBe("FeedFinder/1.0");
      expect(typeof USER_AGENT).toBe("string");
      expect(USER_AGENT.length).toBeGreaterThan(0);
      expect(USER_AGENT).toMatch(/^[A-Za-z0-9/.-]+$/);
    });
  });

  describe("FETCH_TIMEOUT_MS", () => {
    it("should be a positive integer in milliseconds", () => {
      expect(FETCH_TIMEOUT_MS).toBe(5000);
      expect(typeof FETCH_TIMEOUT_MS).toBe("number");
      expect(FETCH_TIMEOUT_MS).toBeGreaterThan(0);
      expect(Number.isInteger(FETCH_TIMEOUT_MS)).toBe(true);
    });
  });
});
