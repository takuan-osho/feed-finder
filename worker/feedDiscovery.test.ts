import { describe, expect, it } from "vitest";

// Import and define the findMetaFeeds function for testing
function findMetaFeeds(html: string, baseUrl: string) {
  const feeds: Array<{
    url: string;
    title: string;
    type: string;
    discoveryMethod: string;
  }> = [];

  // Look for RSS autodiscovery links
  const linkRegex =
    /<link[^>]*(?:type=["'](?:application\/rss\+xml|application\/atom\+xml|text\/xml)["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*type=["'](?:application\/rss\+xml|application\/atom\+xml|text\/xml)["'])[^>]*>/gi;

  let match = linkRegex.exec(html);
  while (match !== null) {
    const href = match[1] || match[2];
    if (href) {
      try {
        const feedUrl = new URL(href, baseUrl).href;
        const titleMatch = match[0].match(/title=["']([^"']+)["']/i);
        const typeMatch = match[0].match(
          /type=["'](application\/(?:rss\+xml|atom\+xml)|text\/xml)["']/i,
        );

        feeds.push({
          url: feedUrl,
          title: titleMatch ? titleMatch[1] : "RSS/Atom Feed",
          type: typeMatch && typeMatch[1].includes("atom") ? "Atom" : "RSS",
          discoveryMethod: "meta-tag",
        });
      } catch {
        // Invalid URL, skip
      }
    }
    match = linkRegex.exec(html);
  }

  return feeds;
}

describe("Feed Discovery", () => {
  describe("findMetaFeeds", () => {
    it("should extract RSS feed from HTML link tag", () => {
      const html = `
        <html>
          <head>
            <title>Test Website</title>
            <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/rss.xml" />
          </head>
          <body>
            <h1>Test Content</h1>
          </body>
        </html>
      `;
      const baseUrl = "https://example.com";
      const feeds = findMetaFeeds(html, baseUrl);

      expect(feeds).toHaveLength(1);
      expect(feeds[0]).toEqual({
        url: "https://example.com/rss.xml",
        title: "RSS Feed",
        type: "RSS",
        discoveryMethod: "meta-tag",
      });
    });

    it("should extract Atom feed from HTML link tag", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/atom+xml" title="Atom Feed" href="/feed.atom" />
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";
      const feeds = findMetaFeeds(html, baseUrl);

      expect(feeds).toHaveLength(1);
      expect(feeds[0]).toEqual({
        url: "https://example.com/feed.atom",
        title: "Atom Feed",
        type: "Atom",
        discoveryMethod: "meta-tag",
      });
    });

    it("should handle multiple feed links", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/rss.xml" />
            <link rel="alternate" type="application/atom+xml" title="Atom Feed" href="/atom.xml" />
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";
      const feeds = findMetaFeeds(html, baseUrl);

      expect(feeds).toHaveLength(2);
      expect(feeds[0].type).toBe("RSS");
      expect(feeds[1].type).toBe("Atom");
    });

    it("should handle absolute URLs in feed links", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" title="External Feed" href="https://external.com/feed.rss" />
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";
      const feeds = findMetaFeeds(html, baseUrl);

      expect(feeds).toHaveLength(1);
      expect(feeds[0].url).toBe("https://external.com/feed.rss");
    });

    it("should provide default title when title is missing", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";
      const feeds = findMetaFeeds(html, baseUrl);

      expect(feeds).toHaveLength(1);
      expect(feeds[0].title).toBe("RSS/Atom フィード");
    });

    it("should handle href and type attributes in different orders", () => {
      const html = `
        <html>
          <head>
            <link href="/feed1.xml" rel="alternate" type="application/rss+xml" title="Feed 1" />
            <link type="application/atom+xml" rel="alternate" href="/feed2.xml" title="Feed 2" />
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";
      const feeds = findMetaFeeds(html, baseUrl);

      expect(feeds).toHaveLength(2);
      expect(feeds[0].url).toBe("https://example.com/feed1.xml");
      expect(feeds[1].url).toBe("https://example.com/feed2.xml");
    });

    it("should skip invalid URLs", () => {
      const html = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="invalid-url" />
            <link rel="alternate" type="application/rss+xml" href="/valid-feed.xml" />
          </head>
        </html>
      `;
      const baseUrl = "not-a-valid-base-url";
      const feeds = findMetaFeeds(html, baseUrl);

      // Should return empty array since both URLs are invalid
      expect(feeds).toHaveLength(0);
    });

    it("should return empty array for HTML without feed links", () => {
      const html = `
        <html>
          <head>
            <title>No Feeds Here</title>
            <link rel="stylesheet" href="/style.css" />
          </head>
        </html>
      `;
      const baseUrl = "https://example.com";
      const feeds = findMetaFeeds(html, baseUrl);

      expect(feeds).toHaveLength(0);
    });
  });
});
