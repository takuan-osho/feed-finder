import { Hono } from "hono";
import { err, ok, okAsync, type Result, ResultAsync } from "neverthrow";

const app = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * Represents a discovered feed with its metadata
 *
 * @public
 */
interface FeedResult {
  /** The absolute URL of the RSS/Atom feed */
  url: string;
  /** Optional title of the feed extracted from HTML meta tags */
  title?: string;
  /** Feed format type - either RSS or Atom */
  type: "rss" | "atom";
  /** Method used to discover the feed */
  method: "html-meta" | "common-path";
}

/**
 * Possible error types that can occur during feed search operations
 *
 * @public
 */
type FeedSearchError =
  | { type: "invalid-url"; message: string }
  | { type: "network-error"; message: string }
  | { type: "parse-error"; message: string }
  | { type: "unknown-error"; message: string };

/**
 * Result of a feed search operation
 *
 * @public
 */
interface SearchResult {
  /** The original URL that was searched */
  originalUrl: string;
  /** Array of discovered feeds */
  feeds: FeedResult[];
}

/**
 * Common feed paths used by popular CMS and blogging platforms
 *
 * @remarks
 * This list includes standard paths used by WordPress, Jekyll, Hugo,
 * and other popular content management systems and static site generators.
 *
 * @internal
 */
const COMMON_FEED_PATHS = [
  "/feed",
  "/rss",
  "/feed.xml",
  "/rss.xml",
  "/atom.xml",
  "/feeds/all.atom.xml",
  "/feed/rss",
  "/index.xml",
  "/blog/feed",
  "/blog/rss",
  "/blog/feed.xml",
  "/blog/rss.xml",
];

/**
 * Normalizes URLs by ensuring they have a protocol and converting HTTP to HTTPS
 *
 * @param url - The URL string to normalize
 * @returns Result containing the normalized URL string or an error
 *
 * @example
 * ```typescript
 * normalizeUrl('example.com') // Returns Ok('https://example.com')
 * normalizeUrl('http://example.com') // Returns Ok('https://example.com')
 * normalizeUrl('https://example.com') // Returns Ok('https://example.com')
 * normalizeUrl('invalid-url') // Returns Err({ type: 'invalid-url', message: 'Invalid URL format' })
 * ```
 *
 * @public
 */
function normalizeUrl(url: string): Result<string, FeedSearchError> {
  const parseUrlAttempt = (urlToTry: string): Result<URL, FeedSearchError> => {
    try {
      return ok(new URL(urlToTry));
    } catch {
      return err({ type: "invalid-url", message: `Invalid URL format: ${urlToTry}` });
    }
  };

  return parseUrlAttempt(url)
    .orElse<string, FeedSearchError>(() => {
      // If URL is invalid, add https:// prefix and retry
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return parseUrlAttempt(`https://${url}`).map((parsed) => {
          // Convert http:// to https://
          if (parsed.protocol === "http:") {
            parsed.protocol = "https:";
          }
          return parsed.toString();
        });
      }
      return err({ type: "invalid-url", message: `Invalid URL format: ${url}` } as FeedSearchError);
    })
    .map((parsedOrString) => {
      if (typeof parsedOrString === "string") {
        return parsedOrString;
      }
      // Convert http:// to https://
      if (parsedOrString.protocol === "http:") {
        parsedOrString.protocol = "https:";
      }
      return parsedOrString.toString();
    });
}

/**
 * Extracts RSS/Atom feed links from HTML using standard autodiscovery meta tags
 *
 * @param html - The HTML content to parse
 * @param baseUrl - The base URL for resolving relative feed URLs
 * @returns Array of discovered feed results
 *
 * @remarks
 * This function implements the RSS Autodiscovery standard by searching for
 * `<link rel="alternate" type="application/rss+xml">` and similar tags.
 *
 * @example
 * ```typescript
 * const html = '<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="My Blog">';
 * const feeds = extractFeedLinksFromHtml(html, 'https://example.com');
 * // Returns: [{ url: 'https://example.com/feed.xml', title: 'My Blog', type: 'rss', method: 'html-meta' }]
 * ```
 *
 * @public
 */
function extractFeedLinksFromHtml(html: string, baseUrl: string): FeedResult[] {
  const feeds: FeedResult[] = [];
  const linkRegex = /<link[^>]*rel="alternate"[^>]*>/gi;
  const matches = html.match(linkRegex);

  if (!matches) return feeds;

  for (const match of matches) {
    const typeMatch = match.match(/type="([^"]*(?:rss|atom)[^"]*)"/i);
    const hrefMatch = match.match(/href="([^"]*)"/i);
    const titleMatch = match.match(/title="([^"]*)"/i);

    if (typeMatch && hrefMatch) {
      const type = typeMatch[1].toLowerCase();
      let feedUrl = hrefMatch[1];
      const title = titleMatch?.[1];

      // Convert relative URLs to absolute URLs
      if (feedUrl.startsWith("/")) {
        const base = new URL(baseUrl);
        feedUrl = `${base.protocol}//${base.host}${feedUrl}`;
      } else if (!feedUrl.startsWith("http")) {
        const base = new URL(baseUrl);
        feedUrl = `${base.protocol}//${base.host}/${feedUrl}`;
      }

      feeds.push({
        url: feedUrl,
        title,
        type: type.includes("atom") ? "atom" : "rss",
        method: "html-meta",
      });
    }
  }

  return feeds;
}

/**
 * Checks if a feed URL exists by sending a HEAD request
 *
 * @param url - The feed URL to check
 * @returns ResultAsync that resolves to true if the feed exists and is accessible
 *
 * @remarks
 * Uses a HEAD request to minimize bandwidth usage while checking availability.
 * Returns an error for any network errors or non-2xx status codes.
 *
 * @example
 * ```typescript
 * const result = await checkFeedExists('https://example.com/feed.xml');
 * result.match(
 *   (exists) => console.log('Feed is available:', exists),
 *   (error) => console.error('Error checking feed:', error)
 * );
 * ```
 *
 * @public
 */
function checkFeedExists(url: string): ResultAsync<boolean, FeedSearchError> {
  return ResultAsync.fromPromise(
    fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Feed-Finder/1.0",
      },
    }),
    (error) =>
      ({
        type: "network-error",
        message: error instanceof Error ? error.message : "Network request failed",
      }) as FeedSearchError
  ).map((response) => response.ok);
}

/**
 * Searches for feeds using common path patterns when HTML meta tags are not available
 *
 * @param baseUrl - The base URL to search for common feed paths
 * @returns ResultAsync that resolves to an array of discovered feeds
 *
 * @remarks
 * This function checks common paths used by popular CMS platforms like WordPress,
 * Jekyll, and Hugo. It serves as a fallback when standard autodiscovery fails.
 *
 * @example
 * ```typescript
 * const result = await findCommonPathFeeds('https://blog.example.com');
 * result.match(
 *   (feeds) => console.log('Found feeds:', feeds),
 *   (error) => console.error('Error finding feeds:', error)
 * );
 * ```
 *
 * @public
 */
function findCommonPathFeeds(baseUrl: string): ResultAsync<FeedResult[], FeedSearchError> {
  return ResultAsync.fromPromise(
    (async () => {
      const base = new URL(baseUrl);
      const feeds: FeedResult[] = [];

      for (const path of COMMON_FEED_PATHS) {
        const feedUrl = `${base.protocol}//${base.host}${path}`;

        const existsResult = await checkFeedExists(feedUrl);
        if (existsResult.isOk() && existsResult.value) {
          feeds.push({
            url: feedUrl,
            type: path.includes("atom") ? "atom" : "rss",
            method: "common-path",
          });
        }
      }

      return feeds;
    })(),
    (error) =>
      ({
        type: "unknown-error",
        message: error instanceof Error ? error.message : "Unknown error in findCommonPathFeeds",
      }) as FeedSearchError
  );
}

/**
 * Main feed search function implementing a hybrid discovery approach
 *
 * @param url - The URL to search for RSS/Atom feeds
 * @returns ResultAsync that resolves to a SearchResult containing discovered feeds
 *
 * @remarks
 * This function uses a two-step hybrid approach:
 * 1. First, it attempts to find feeds using HTML meta tags (RSS Autodiscovery standard)
 * 2. If no feeds are found, it falls back to checking common feed paths
 *
 * The hybrid approach maximizes discovery success while minimizing false positives
 * and unnecessary HTTP requests.
 *
 * @example
 * ```typescript
 * const result = await searchFeeds('https://blog.example.com');
 * result.match(
 *   (searchResult) => {
 *     if (searchResult.feeds.length > 0) {
 *       console.log(`Found ${searchResult.feeds.length} feeds`);
 *       searchResult.feeds.forEach(feed => console.log(feed.url));
 *     } else {
 *       console.log('No feeds found');
 *     }
 *   },
 *   (error) => console.error('Search failed:', error)
 * );
 * ```
 *
 * @public
 */
function searchFeeds(url: string): ResultAsync<SearchResult, FeedSearchError> {
  return normalizeUrl(url).asyncAndThen((normalizedUrl) => {
    // Step 1: Fetch HTML and search for feeds from meta tags
    const fetchHtmlFeeds = ResultAsync.fromPromise(
      fetch(normalizedUrl, {
        headers: {
          "User-Agent": "Feed-Finder/1.0",
        },
      }),
      (error) =>
        ({
          type: "network-error",
          message: error instanceof Error ? error.message : "Failed to fetch HTML",
        }) as FeedSearchError
    )
      .andThen((response) => {
        if (!response.ok) {
          return err({
            type: "network-error",
            message: `HTTP ${response.status}: ${response.statusText}`,
          } as FeedSearchError);
        }
        return ResultAsync.fromPromise(
          response.text(),
          (error) =>
            ({
              type: "parse-error",
              message: error instanceof Error ? error.message : "Failed to parse HTML",
            }) as FeedSearchError
        );
      })
      .map((html) => extractFeedLinksFromHtml(html, normalizedUrl))
      .orElse(() => okAsync([] as FeedResult[]))
      .andThen((htmlFeeds) => {
        // Step 2: If not found in meta tags, try common paths
        if (htmlFeeds.length === 0) {
          return findCommonPathFeeds(normalizedUrl);
        }
        return okAsync(htmlFeeds);
      })
      .map(
        (feeds) =>
          ({
            originalUrl: url,
            feeds,
          }) as SearchResult
      );

    return fetchHtmlFeeds;
  });
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 *
 * @param unsafe - The unsafe string that may contain HTML special characters
 * @returns The HTML-escaped safe string
 *
 * @example
 * ```typescript
 * escapeHtml('<script>alert("xss")</script>') // Returns '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * ```
 *
 * @internal
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generates HTML markup for displaying search results
 *
 * @param result - Result containing SearchResult or FeedSearchError
 * @returns HTML string formatted for display in the web interface
 *
 * @remarks
 * This function creates responsive HTML using DaisyUI components to display:
 * - Error messages for failed searches
 * - Warning messages when no feeds are found
 * - Success messages with feed cards showing URLs, titles, and action buttons
 *
 * All user-controlled data is properly HTML-escaped to prevent XSS attacks.
 *
 * @example
 * ```typescript
 * const result = ok({ originalUrl: 'https://example.com', feeds: [...] });
 * const html = generateResultHtml(result);
 * // Returns formatted HTML with feed cards
 * ```
 *
 * @internal
 */
function generateResultHtml(result: Result<SearchResult, FeedSearchError>): string {
  return result.match(
    (searchResult) => {
      if (searchResult.feeds.length === 0) {
        return `
          <div class="alert alert-warning">
            <span>フィードが見つかりませんでした。</span>
          </div>
        `;
      }

      const feedItems = searchResult.feeds
        .map((feed) => {
          const safeUrl = escapeHtml(feed.url);
          const safeTitle = escapeHtml(feed.title || "フィード");

          return `
        <div class="card bg-base-200 shadow-md">
          <div class="card-body">
            <h3 class="card-title text-lg">
              ${safeTitle}
              <span class="badge badge-primary">${feed.type.toUpperCase()}</span>
            </h3>
            <p class="text-sm opacity-70">検索方法: ${feed.method === "html-meta" ? "HTML meta tag" : "一般的なパス"}</p>
            <div class="card-actions justify-end">
              <a href="${safeUrl}" target="_blank" class="btn btn-primary btn-sm">
                フィードを開く
              </a>
              <button onclick="navigator.clipboard.writeText(${JSON.stringify(feed.url)})" class="btn btn-outline btn-sm">
                URLをコピー
              </button>
            </div>
            <div class="text-xs font-mono bg-base-300 p-2 rounded mt-2">
              ${safeUrl}
            </div>
          </div>
        </div>
      `;
        })
        .join("");

      return `
        <div class="space-y-4">
          <div class="alert alert-success">
            <span>${searchResult.feeds.length}個のフィードが見つかりました。</span>
          </div>
          ${feedItems}
        </div>
      `;
    },
    (error) => {
      return `
        <div class="alert alert-error">
          <span>エラー: ${escapeHtml(error.message)}</span>
        </div>
      `;
    }
  );
}

/**
 * HTTP route handlers for the feed finder web application
 *
 * @remarks
 * The application provides two main routes:
 * - GET / : Serves the main search form interface
 * - POST /search : Processes feed search requests and returns results
 *
 * Both routes return complete HTML pages with embedded CSS styling.
 */

// Route definitions
app.get("/", (c) => {
  return c.html(`
    <!doctype html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Feed Finder - RSS/Atomフィード検索</title>
        <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      </head>
      <body class="min-h-screen bg-base-100">
        <div class="container mx-auto px-4 py-8">
          <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-primary mb-2">Feed Finder</h1>
            <p class="text-base-content/70">サイトのRSS/Atomフィードを検索します</p>
          </div>

          <div class="max-w-2xl mx-auto">
            <form method="POST" action="/search" class="space-y-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">サイトのURL</span>
                </label>
                <input
                  type="url"
                  name="url"
                  placeholder="https://example.com"
                  class="input input-bordered w-full"
                  required
                />
              </div>
              <button type="submit" class="btn btn-primary w-full">
                フィードを検索
              </button>
            </form>
          </div>
        </div>
      </body>
    </html>
  `);
});

app.post("/search", async (c) => {
  const formData = await c.req.formData();
  const url = formData.get("url") as string;

  if (!url) {
    const errorResult = err({
      type: "invalid-url",
      message: "URLが入力されていません。",
    } as FeedSearchError);
    const resultHtml = generateResultHtml(errorResult);
    return c.html(`
      <!doctype html>
      <html lang="ja">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Feed Finder - 検索結果</title>
          <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
          <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        </head>
        <body class="min-h-screen bg-base-100">
          <div class="container mx-auto px-4 py-8">
            <div class="text-center mb-8">
              <h1 class="text-4xl font-bold text-primary mb-2">Feed Finder</h1>
              <p class="text-base-content/70">サイトのRSS/Atomフィードを検索します</p>
            </div>

            <div class="max-w-2xl mx-auto mb-8">
              <form method="POST" action="/search" class="space-y-4">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">サイトのURL</span>
                  </label>
                  <input
                    type="url"
                    name="url"
                    placeholder="https://example.com"
                    class="input input-bordered w-full"
                    required
                  />
                </div>
                <button type="submit" class="btn btn-primary w-full">
                  フィードを検索
                </button>
              </form>
            </div>

            <div class="max-w-4xl mx-auto">
              ${resultHtml}
            </div>
          </div>
        </body>
      </html>
    `);
  }

  const searchResult = await searchFeeds(url);
  const resultHtml = generateResultHtml(searchResult);

  return c.html(`
    <!doctype html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Feed Finder - 検索結果</title>
        <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      </head>
      <body class="min-h-screen bg-base-100">
        <div class="container mx-auto px-4 py-8">
          <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-primary mb-2">Feed Finder</h1>
            <p class="text-base-content/70">サイトのRSS/Atomフィードを検索します</p>
          </div>

          <div class="max-w-2xl mx-auto mb-8">
            <form method="POST" action="/search" class="space-y-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">サイトのURL</span>
                </label>
                <input
                  type="url"
                  name="url"
                  placeholder="https://example.com"
                  class="input input-bordered w-full"
                  value="${escapeHtml(url)}"
                  required
                />
              </div>
              <button type="submit" class="btn btn-primary w-full">
                フィードを検索
              </button>
            </form>
          </div>

          <div class="max-w-4xl mx-auto">
            ${resultHtml}
          </div>
        </div>
      </body>
    </html>
  `);
});

export default app;
