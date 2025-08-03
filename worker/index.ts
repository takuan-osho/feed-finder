export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/search-feeds" && request.method === "POST") {
        return handleFeedSearch(request);
      }
      return new Response("Not Found", { status: 404 });
    }
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleFeedSearch(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const { url: targetUrl } = body;

    if (!targetUrl || typeof targetUrl !== "string") {
      return Response.json(
        {
          success: false,
          error: "URLが指定されていません",
        },
        { status: 400 },
      );
    }

    // URL validation and normalization
    let normalizedUrl: URL;
    try {
      normalizedUrl = new URL(
        targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`,
      );
    } catch {
      return Response.json(
        {
          success: false,
          error: "無効なURLです",
        },
        { status: 400 },
      );
    }

    const feeds = await discoverFeeds(normalizedUrl.href);

    return Response.json({
      success: true,
      searchedUrl: normalizedUrl.href,
      totalFound: feeds.length,
      feeds,
    });
  } catch (error) {
    console.error("Feed search error:", error);
    return Response.json(
      {
        success: false,
        error: "フィード検索中にエラーが発生しました",
      },
      { status: 500 },
    );
  }
}

async function discoverFeeds(targetUrl: string): Promise<FeedResult[]> {
  const feeds: FeedResult[] = [];
  const foundUrls = new Set<string>();

  try {
    // Fetch the main page
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "FeedFinder/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();

    // 1. Look for RSS autodiscovery links in HTML
    const metaFeeds = await findMetaFeeds(html, targetUrl);
    metaFeeds.forEach((feed) => {
      if (!foundUrls.has(feed.url)) {
        foundUrls.add(feed.url);
        feeds.push(feed);
      }
    });

    // 2. Try common feed paths
    const commonFeeds = await tryCommonPaths(targetUrl);
    commonFeeds.forEach((feed) => {
      if (!foundUrls.has(feed.url)) {
        foundUrls.add(feed.url);
        feeds.push(feed);
      }
    });
  } catch (error) {
    console.error("Discovery error:", error);
  }

  return feeds;
}

function findMetaFeeds(html: string, baseUrl: string): FeedResult[] {
  const feeds: FeedResult[] = [];

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
          title: titleMatch ? titleMatch[1] : "RSS/Atom フィード",
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

async function tryCommonPaths(baseUrl: string): Promise<FeedResult[]> {
  const commonPaths = [
    "/feed",
    "/feeds",
    "/rss",
    "/rss.xml",
    "/feed.xml",
    "/atom.xml",
    "/index.xml",
  ];

  const feeds: FeedResult[] = [];

  for (const path of commonPaths) {
    try {
      const feedUrl = new URL(path, baseUrl).href;
      const response = await fetch(feedUrl, {
        method: "HEAD",
        headers: {
          "User-Agent": "FeedFinder/1.0",
        },
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (
          contentType.includes("xml") ||
          contentType.includes("rss") ||
          contentType.includes("atom")
        ) {
          feeds.push({
            url: feedUrl,
            title: `${path} フィード`,
            type: contentType.includes("atom") ? "Atom" : "RSS",
            discoveryMethod: "common-path",
          });
        }
      }
    } catch {
      // Failed to fetch, continue to next path
    }
  }

  return feeds;
}

interface FeedResult {
  url: string;
  title: string;
  type: "RSS" | "Atom";
  description?: string;
  discoveryMethod: "meta-tag" | "common-path";
}
