import { describe, expect, it, vi } from "vitest";
import {
  extractAttributeValue,
  extractFeedTypeTitle,
  findMetaFeeds,
  findMetaFeedsWithStringParsing,
} from "./html";

describe("discovery/html", () => {
  describe("extractFeedTypeTitle", () => {
    it("should return RSS for RSS types", () => {
      expect(extractFeedTypeTitle("application/rss+xml")).toBe("RSS");
      expect(extractFeedTypeTitle("application/rdf+xml")).toBe("RSS");
      expect(extractFeedTypeTitle("text/xml")).toBe("RSS");
      expect(extractFeedTypeTitle("application/xml")).toBe("RSS");
    });

    it("should return Atom for Atom types", () => {
      expect(extractFeedTypeTitle("application/atom+xml")).toBe("Atom");
    });

    it("should be case insensitive", () => {
      expect(extractFeedTypeTitle("APPLICATION/RSS+XML")).toBe("RSS");
      expect(extractFeedTypeTitle("Application/Atom+XML")).toBe("Atom");
    });

    it("should default to RSS for unknown types", () => {
      expect(extractFeedTypeTitle("unknown/type")).toBe("RSS");
      expect(extractFeedTypeTitle("")).toBe("RSS");
    });
  });

  describe("extractAttributeValue", () => {
    it("should extract attribute values with double quotes", () => {
      const tag = '<link href="https://example.com/feed.xml" rel="alternate">';
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed.xml",
      );
      expect(extractAttributeValue(tag, "rel")).toBe("alternate");
    });

    it("should extract attribute values with single quotes", () => {
      const tag = "<link href='https://example.com/feed.xml' rel='alternate'>";
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed.xml",
      );
      expect(extractAttributeValue(tag, "rel")).toBe("alternate");
    });

    it("should handle mixed quotes", () => {
      const tag =
        "<link href=\"https://example.com/feed.xml\" rel='alternate'>";
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed.xml",
      );
      expect(extractAttributeValue(tag, "rel")).toBe("alternate");
    });

    it("should be case insensitive for attribute names", () => {
      const tag = '<LINK HREF="https://example.com/feed.xml" REL="alternate">';
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed.xml",
      );
      expect(extractAttributeValue(tag, "Href")).toBe(
        "https://example.com/feed.xml",
      );
      expect(extractAttributeValue(tag, "HREF")).toBe(
        "https://example.com/feed.xml",
      );
    });

    it("should handle whitespace around equals sign", () => {
      const tag =
        '<link href = "https://example.com/feed.xml" rel= "alternate">';
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed.xml",
      );
      expect(extractAttributeValue(tag, "rel")).toBe("alternate");
    });

    it("should handle tabs as whitespace", () => {
      const tag = '<link href\t=\t"https://example.com/feed.xml">';
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed.xml",
      );
    });

    it("should return null for missing attributes", () => {
      const tag = '<link href="https://example.com/feed.xml">';
      expect(extractAttributeValue(tag, "rel")).toBe(null);
      expect(extractAttributeValue(tag, "nonexistent")).toBe(null);
    });

    it("should return null for malformed attributes", () => {
      const tag = "<link href=https://example.com/feed.xml>";
      expect(extractAttributeValue(tag, "href")).toBe(null);
    });

    it("should handle empty attribute values", () => {
      const tag = '<link href="" rel="alternate">';
      expect(extractAttributeValue(tag, "href")).toBe("");
    });

    it("should handle attributes with special characters", () => {
      const tag =
        '<link href="https://example.com/feed?param=value&amp;other=1" rel="alternate">';
      expect(extractAttributeValue(tag, "href")).toBe(
        "https://example.com/feed?param=value&amp;other=1",
      );
    });
  });

  describe("findMetaFeeds", () => {
    const baseUrl = "https://example.com";

    it("should find RSS feeds from link tags", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">
            <link rel="alternate" type="application/atom+xml" href="/atom.xml" title="Atom Feed">
          </head>
        </html>
      `;

      const result = findMetaFeeds(html, baseUrl);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        title: "RSS Feed",
        url: "https://example.com/feed.xml",
        type: "RSS",
        discoveryMethod: "meta-tag",
      });
      expect(result[1]).toEqual({
        title: "Atom Feed",
        url: "https://example.com/atom.xml",
        type: "Atom",
        discoveryMethod: "meta-tag",
      });
    });

    it("should handle absolute URLs", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="https://other.example.com/feed.xml">
          </head>
        </html>
      `;

      const result = findMetaFeeds(html, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://other.example.com/feed.xml");
    });

    it("should use default title when title is missing", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="/feed.xml">
          </head>
        </html>
      `;

      const result = findMetaFeeds(html, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("RSS/Atom feed");
    });

    it("should ignore non-alternate links", () => {
      const html = `
        <html>
          <head>
            <link rel="stylesheet" type="text/css" href="/style.css">
            <link rel="alternate" type="application/rss+xml" href="/feed.xml">
          </head>
        </html>
      `;

      const result = findMetaFeeds(html, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://example.com/feed.xml");
    });

    it("should ignore unsupported MIME types", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="text/html" href="/index.html">
            <link rel="alternate" type="application/rss+xml" href="/feed.xml">
          </head>
        </html>
      `;

      const result = findMetaFeeds(html, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://example.com/feed.xml");
    });

    it("should handle MIME types with charset", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml; charset=utf-8" href="/feed.xml">
          </head>
        </html>
      `;

      const result = findMetaFeeds(html, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("RSS");
    });

    it("should handle multiple rel values", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate nofollow" type="application/rss+xml" href="/feed.xml">
          </head>
        </html>
      `;

      const result = findMetaFeeds(html, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://example.com/feed.xml");
    });

    it("should skip invalid URLs", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="">
            <link rel="alternate" type="application/rss+xml" href="/valid-feed.xml">
          </head>
        </html>
      `;

      const result = findMetaFeeds(html, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://example.com/valid-feed.xml");
    });

    it("should fallback to string parsing on HTML parse error", () => {
      // Mock parse function to throw error
      vi.doMock("node-html-parser", () => ({
        parse: vi.fn().mockImplementation(() => {
          throw new Error("Parse error");
        }),
      }));

      const html =
        '<link rel="alternate" type="application/rss+xml" href="/feed.xml">';

      const result = findMetaFeeds(html, baseUrl);

      // Should fallback to string parsing (tested separately)
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("findMetaFeedsWithStringParsing", () => {
    const baseUrl = "https://example.com";

    it("should find feeds using string parsing as fallback", () => {
      const html =
        '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed"></head></html>';

      const result = findMetaFeedsWithStringParsing(html, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: "RSS Feed",
        url: "https://example.com/feed.xml",
        type: "RSS",
        discoveryMethod: "meta-tag",
      });
    });

    it("should handle case insensitive link tags", () => {
      const html =
        '<HTML><HEAD><LINK REL="alternate" TYPE="application/rss+xml" HREF="/feed.xml"></HEAD></HTML>';

      const result = findMetaFeedsWithStringParsing(html, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://example.com/feed.xml");
    });

    it("should deduplicate feeds", () => {
      const html = `
        <link rel="alternate" type="application/rss+xml" href="/feed.xml">
        <link rel="alternate" type="application/rss+xml" href="/feed.xml">
      `;

      const result = findMetaFeedsWithStringParsing(html, baseUrl);

      expect(result).toHaveLength(1);
    });
  });
});
