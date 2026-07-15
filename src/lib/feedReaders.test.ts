import { describe, expect, it } from "vitest";
import { getFeedReaderLinks } from "./feedReaders";

describe("getFeedReaderLinks", () => {
  it("builds reader deep links for supported RSS readers", () => {
    const links = getFeedReaderLinks("https://example.com/feed.xml");

    expect(links).toEqual([
      {
        id: "feedly",
        label: "Feedly",
        url: "https://feedly.com/i/subscription/feed%2Fhttps%3A%2F%2Fexample.com%2Ffeed.xml",
      },
      {
        id: "inoreader",
        label: "Inoreader",
        url: "https://www.inoreader.com?add_feed=https%3A%2F%2Fexample.com%2Ffeed.xml",
      },
      {
        id: "newsblur",
        label: "NewsBlur",
        url: "https://www.newsblur.com/?url=https%3A%2F%2Fexample.com%2Ffeed.xml",
      },
      {
        id: "the-old-reader",
        label: "The Old Reader",
        url: "https://theoldreader.com/feeds/subscribe?url=https%3A%2F%2Fexample.com%2Ffeed.xml",
      },
      {
        id: "feedbin",
        label: "Feedbin",
        url: "https://feedbin.com/?subscribe=https%3A%2F%2Fexample.com%2Ffeed.xml",
      },
    ]);
  });

  it("encodes query strings and non-ASCII characters in feed URLs", () => {
    const [feedlyLink, inoreaderLink] = getFeedReaderLinks(
      "https://example.com/feed.xml?tag=日本語&format=atom",
    );

    expect(feedlyLink.url).toBe(
      "https://feedly.com/i/subscription/feed%2Fhttps%3A%2F%2Fexample.com%2Ffeed.xml%3Ftag%3D%E6%97%A5%E6%9C%AC%E8%AA%9E%26format%3Datom",
    );
    expect(inoreaderLink.url).toBe(
      "https://www.inoreader.com?add_feed=https%3A%2F%2Fexample.com%2Ffeed.xml%3Ftag%3D%E6%97%A5%E6%9C%AC%E8%AA%9E%26format%3Datom",
    );
  });

  it("returns no reader links for malformed feed URLs", () => {
    expect(getFeedReaderLinks("not a url")).toEqual([]);
  });

  it("returns no reader links for unsupported URL schemes", () => {
    expect(getFeedReaderLinks("javascript:alert(1)")).toEqual([]);
    expect(getFeedReaderLinks("data:text/xml,hello")).toEqual([]);
    expect(getFeedReaderLinks("ftp://example.com/feed.xml")).toEqual([]);
  });
});
