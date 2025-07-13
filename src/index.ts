import { Hono } from "hono";

const app = new Hono<{ Bindings: CloudflareBindings }>();

interface FeedResult {
  url: string;
  title?: string;
  type: 'rss' | 'atom';
  method: 'html-meta' | 'common-path';
}

interface SearchResult {
  originalUrl: string;
  feeds: FeedResult[];
  error?: string;
}

// Common feed paths list
const COMMON_FEED_PATHS = [
  '/feed',
  '/rss',
  '/feed.xml',
  '/rss.xml',
  '/atom.xml',
  '/feeds/all.atom.xml',
  '/feed/rss',
  '/index.xml',
  '/blog/feed',
  '/blog/rss',
  '/blog/feed.xml',
  '/blog/rss.xml'
];

// Function to normalize URLs
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Convert http:// to https://
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return parsed.toString();
  } catch {
    // If URL is invalid, add https:// prefix and retry
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return normalizeUrl(`https://${url}`);
    }
    throw new Error('Invalid URL');
  }
}

// Function to extract feed links from HTML
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
      if (feedUrl.startsWith('/')) {
        const base = new URL(baseUrl);
        feedUrl = `${base.protocol}//${base.host}${feedUrl}`;
      } else if (!feedUrl.startsWith('http')) {
        const base = new URL(baseUrl);
        feedUrl = `${base.protocol}//${base.host}/${feedUrl}`;
      }

      feeds.push({
        url: feedUrl,
        title,
        type: type.includes('atom') ? 'atom' : 'rss',
        method: 'html-meta'
      });
    }
  }

  return feeds;
}

// Function to check if feed URL exists
async function checkFeedExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Feed-Finder/1.0'
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Function to search for feeds using common paths
async function findCommonPathFeeds(baseUrl: string): Promise<FeedResult[]> {
  const base = new URL(baseUrl);
  const feeds: FeedResult[] = [];

  for (const path of COMMON_FEED_PATHS) {
    const feedUrl = `${base.protocol}//${base.host}${path}`;
    
    if (await checkFeedExists(feedUrl)) {
      feeds.push({
        url: feedUrl,
        type: path.includes('atom') ? 'atom' : 'rss',
        method: 'common-path'
      });
    }
  }

  return feeds;
}

// Main feed search function
async function searchFeeds(url: string): Promise<SearchResult> {
  try {
    const normalizedUrl = normalizeUrl(url);
    const result: SearchResult = {
      originalUrl: url,
      feeds: []
    };

    // Step 1: Fetch HTML and search for feeds from meta tags
    try {
      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Feed-Finder/1.0'
        }
      });

      if (response.ok) {
        const html = await response.text();
        const htmlFeeds = extractFeedLinksFromHtml(html, normalizedUrl);
        result.feeds.push(...htmlFeeds);
      }
    } catch (error) {
      console.error('HTML fetch failed:', error);
    }

    // Step 2: If not found in meta tags, try common paths
    if (result.feeds.length === 0) {
      const commonPathFeeds = await findCommonPathFeeds(normalizedUrl);
      result.feeds.push(...commonPathFeeds);
    }

    return result;
  } catch (error) {
    return {
      originalUrl: url,
      feeds: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Function to generate HTML response
function generateResultHtml(result: SearchResult): string {
  if (result.error) {
    return `
      <div class="alert alert-error">
        <span>エラー: ${result.error}</span>
      </div>
    `;
  }

  if (result.feeds.length === 0) {
    return `
      <div class="alert alert-warning">
        <span>フィードが見つかりませんでした。</span>
      </div>
    `;
  }

  const feedItems = result.feeds.map(feed => `
    <div class="card bg-base-200 shadow-md">
      <div class="card-body">
        <h3 class="card-title text-lg">
          ${feed.title || 'フィード'}
          <span class="badge badge-primary">${feed.type.toUpperCase()}</span>
        </h3>
        <p class="text-sm opacity-70">検索方法: ${feed.method === 'html-meta' ? 'HTML meta tag' : '一般的なパス'}</p>
        <div class="card-actions justify-end">
          <a href="${feed.url}" target="_blank" class="btn btn-primary btn-sm">
            フィードを開く
          </a>
          <button onclick="navigator.clipboard.writeText('${feed.url}')" class="btn btn-outline btn-sm">
            URLをコピー
          </button>
        </div>
        <div class="text-xs font-mono bg-base-300 p-2 rounded mt-2">
          ${feed.url}
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div class="space-y-4">
      <div class="alert alert-success">
        <span>${result.feeds.length}個のフィードが見つかりました。</span>
      </div>
      ${feedItems}
    </div>
  `;
}

// Route definitions
app.get("/", (c) => {
  return c.html(`
    <!doctype html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Feed Finder - RSS/Atomフィード検索</title>
        <link rel="stylesheet" href="/src/styles.css" />
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
  const url = formData.get('url') as string;

  if (!url) {
    return c.html(`
      <div class="alert alert-error">
        <span>URLが入力されていません。</span>
      </div>
    `);
  }

  const result = await searchFeeds(url);
  const resultHtml = generateResultHtml(result);

  return c.html(`
    <!doctype html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Feed Finder - 検索結果</title>
        <link rel="stylesheet" href="/src/styles.css" />
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
                  value="${url}"
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
