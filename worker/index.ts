/**
 * Adds security headers to the response
 */
function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff");

  // Prevent embedding in frames
  headers.set("X-Frame-Options", "DENY");

  // Enable XSS protection
  headers.set("X-XSS-Protection", "1; mode=block");

  // Control referrer information
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Basic Content Security Policy
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'none'; object-src 'none'",
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/search-feeds" && request.method === "POST") {
        const response = await handleFeedSearch(request);
        return addSecurityHeaders(response);
      }
      const notFoundResponse = new Response("Not Found", { status: 404 });
      return addSecurityHeaders(notFoundResponse);
    }
    const notFoundResponse = new Response(null, { status: 404 });
    return addSecurityHeaders(notFoundResponse);
  },
} satisfies ExportedHandler<Env>;

/**
 * Validates URLs to prevent SSRF attacks
 * Blocks access to private IP ranges, localhost, and metadata services
 */
function isValidTargetUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);

    // Only allow HTTP/HTTPS protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { valid: false, error: "Only HTTP/HTTPS protocols are supported" };
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost and loopback addresses
    if (hostname === "localhost" || hostname.startsWith("127.")) {
      return { valid: false, error: "Access to localhost is not permitted" };
    }

    // Block private IP address ranges
    const privateRanges = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^169\.254\./, // 169.254.0.0/16 (link-local/metadata service)
      /^fc00:/, // fc00::/7 (IPv6 private)
      /^::1$/, // IPv6 loopback
    ];

    if (privateRanges.some((range) => range.test(hostname))) {
      return {
        valid: false,
        error: "Access to private IP addresses is not permitted",
      };
    }

    // Restrict port numbers (block uncommon ports)
    const port = parsedUrl.port;
    if (port && !["80", "443", "8080", "8443"].includes(port)) {
      return { valid: false, error: "Access to this port is not permitted" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

async function handleFeedSearch(request: Request) {
  try {
    let body: { url?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          success: false,
          error: "Invalid request body",
        },
        { status: 400 },
      );
    }
    const { url: targetUrl } = body;

    if (!targetUrl || typeof targetUrl !== "string") {
      return Response.json(
        {
          success: false,
          error: "URL is required",
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
          error: "Invalid URL format",
        },
        { status: 400 },
      );
    }

    // SSRF protection: Check URL safety
    const validation = isValidTargetUrl(normalizedUrl.href);
    if (!validation.valid) {
      return Response.json(
        {
          success: false,
          error: validation.error || "URL is not permitted",
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
    // Additional safety check before fetching
    const validation = isValidTargetUrl(targetUrl);
    if (!validation.valid) {
      throw new Error(`URL validation failed: ${validation.error}`);
    }

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
    const metaFeeds = findMetaFeeds(html, targetUrl);
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

export function findMetaFeeds(html: string, baseUrl: string): FeedResult[] {
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

      // Validate each constructed URL to prevent SSRF
      const validation = isValidTargetUrl(feedUrl);
      if (!validation.valid) {
        continue; // Skip this URL if validation fails
      }

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
