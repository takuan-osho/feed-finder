export interface FeedReaderLink {
  id: string;
  label: string;
  url: string;
}

// Initial Issue #37 deep-link targets: broadly used hosted readers with URL-based add/open flows.
const FEED_READERS = [
  {
    id: "feedly",
    label: "Feedly",
    buildUrl: (feedUrl: string) =>
      `https://feedly.com/i/subscription/${encodeURIComponent(`feed/${feedUrl}`)}`,
  },
  {
    id: "inoreader",
    label: "Inoreader",
    buildUrl: (feedUrl: string) =>
      `https://www.inoreader.com?add_feed=${encodeURIComponent(feedUrl)}`,
  },
  {
    id: "newsblur",
    label: "NewsBlur",
    buildUrl: (feedUrl: string) =>
      `https://www.newsblur.com/?url=${encodeURIComponent(feedUrl)}`,
  },
  {
    id: "the-old-reader",
    label: "The Old Reader",
    buildUrl: (feedUrl: string) =>
      `https://theoldreader.com/feeds/subscribe?url=${encodeURIComponent(feedUrl)}`,
  },
  {
    id: "feedbin",
    label: "Feedbin",
    buildUrl: (feedUrl: string) =>
      `https://feedbin.com/?subscribe=${encodeURIComponent(feedUrl)}`,
  },
] as const;

export function getFeedReaderLinks(feedUrl: string): FeedReaderLink[] {
  if (!isHttpFeedUrl(feedUrl)) {
    return [];
  }

  return FEED_READERS.map((reader) => ({
    id: reader.id,
    label: reader.label,
    url: reader.buildUrl(feedUrl),
  }));
}

function isHttpFeedUrl(feedUrl: string): boolean {
  try {
    const url = new URL(feedUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
