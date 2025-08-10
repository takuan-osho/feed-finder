import { err, ok, Result, ResultAsync } from "neverthrow";
import { parse } from "node-html-parser";

/**
 * Error types for type-safe error handling
 */
type ValidationError =
  | { type: "INVALID_REQUEST_BODY"; message: string }
  | { type: "MISSING_URL"; message: string }
  | { type: "INVALID_URL_FORMAT"; message: string }
  | { type: "URL_NOT_PERMITTED"; message: string };

type FeedDiscoveryError =
  | { type: "FETCH_FAILED"; message: string; status?: number }
  | { type: "NETWORK_ERROR"; message: string }
  | { type: "TIMEOUT_ERROR"; message: string }
  | { type: "PARSING_ERROR"; message: string };

type AppError = ValidationError | FeedDiscoveryError;

/**
 * Default title for feeds when no title is found in meta tags
 */
const DEFAULT_FEED_TITLE = "RSS/Atom feed";

/**
 * Supported feed MIME types for detection
 * Note: Generic XML types (text/xml, application/xml) fall back to RSS.
 */
const SUPPORTED_FEED_TYPES = [
  "application/rss+xml",
  "application/atom+xml",
  "application/rdf+xml", // RSS 1.0 (RDF)
  "text/xml",
  "application/xml",
];

/**
 * Allowed origins for CORS requests
 */
const ALLOWED_ORIGINS = [
  "http://localhost:5173", // Vite dev server
  "http://localhost:3000", // Common dev port
  "https://feed-finder.shimizu-taku.workers.dev", // Production domain
  "https://feedfinder.programarch.com", // Another production domain
  "https://feedfinder.takuan-osho.com", // Another production domain
  "https://feedfinder.takuan-osho.net", // Another production domain
];

/**
 * Adds security headers and CORS headers to the response
 */
function addSecurityHeaders(response: Response, request?: Request): Response {
  const headers = new Headers(response.headers);

  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff");

  // Prevent embedding in frames
  headers.set("X-Frame-Options", "DENY");

  // Control referrer information
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Basic Content Security Policy
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'none'; object-src 'none'",
  );

  // Add CORS headers with proper origin validation
  if (request) {
    const origin = request.headers.get("Origin");

    // Only set CORS headers for allowed origins
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
    }

    // Set other CORS headers
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400"); // 24 hours
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Handles preflight CORS requests
 */
function handleCorsPreflightRequest(request: Request): Response {
  const origin = request.headers.get("Origin");

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  const headers = new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });

  return new Response(null, { status: 204, headers });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return handleCorsPreflightRequest(request);
    }

    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/search-feeds" && request.method === "POST") {
        const response = await handleFeedSearch(request);
        return addSecurityHeaders(response, request);
      }
      const notFoundResponse = new Response("Not Found", { status: 404 });
      return addSecurityHeaders(notFoundResponse, request);
    }
    const notFoundResponse = new Response(null, { status: 404 });
    return addSecurityHeaders(notFoundResponse, request);
  },
};

/**
 * Validates URLs to prevent SSRF attacks using Result type
 * Blocks access to private IP ranges, localhost, and metadata services
 */
const safeCreateUrl = Result.fromThrowable(
  (url: string) => new URL(url),
  (): ValidationError => ({
    type: "INVALID_URL_FORMAT" as const,
    message: "Invalid URL format",
  }),
);

export function validateTargetUrl(url: string): Result<URL, ValidationError> {
  return safeCreateUrl(url).andThen((parsedUrl) => {
    // Only allow HTTP/HTTPS protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return err({
        type: "URL_NOT_PERMITTED" as const,
        message: "Only HTTP/HTTPS protocols are supported",
      });
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost and loopback addresses
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname === "0:0:0:0:0:0:0:1" ||
      hostname === "0000:0000:0000:0000:0000:0000:0000:0001"
    ) {
      return err({
        type: "URL_NOT_PERMITTED" as const,
        message: "Access to localhost is not permitted",
      });
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
      return err({
        type: "URL_NOT_PERMITTED" as const,
        message: "Access to private IP addresses is not permitted",
      });
    }

    // Restrict port numbers (block uncommon ports)
    const port = parsedUrl.port;
    if (port && !["80", "443", "8080", "8443"].includes(port)) {
      return err({
        type: "URL_NOT_PERMITTED" as const,
        message: "Access to this port is not permitted",
      });
    }

    return ok(parsedUrl);
  });
}

/**
 * Parses and validates request body
 */
export function parseRequestBody(
  body: unknown,
): Result<string, ValidationError> {
  if (!body || typeof body !== "object") {
    return err({
      type: "INVALID_REQUEST_BODY" as const,
      message: "Invalid request body",
    });
  }

  const { url: targetUrl } = body as { url?: unknown };
  if (!targetUrl || typeof targetUrl !== "string") {
    return err({
      type: "MISSING_URL" as const,
      message: "URL is required",
    });
  }

  return ok(targetUrl);
}

/**
 * Normalizes URL by adding https if no protocol is specified
 */
export function normalizeUrl(url: string): Result<string, ValidationError> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  // Validate that the normalized URL is properly formed
  return safeCreateUrl(normalizedUrl)
    .map(() => normalizedUrl)
    .mapErr(
      (): ValidationError => ({
        type: "INVALID_URL_FORMAT" as const,
        message: "Invalid URL format",
      }),
    );
}

/**
 * Secure error response helper that prevents information leakage
 */
function createErrorResponse(error: AppError): Response {
  // Log detailed error information for debugging (server-side only)
  const errorId = Math.random().toString(36).slice(2, 11);
  console.error(
    `[${errorId}] Error type: ${error.type}, Details: ${error.message}`,
  );

  // Return generic user-friendly message to prevent information disclosure
  const userMessage = (() => {
    switch (error.type) {
      case "INVALID_REQUEST_BODY":
      case "MISSING_URL":
      case "INVALID_URL_FORMAT":
      case "URL_NOT_PERMITTED":
        return "Invalid request. Please check your input and try again.";
      case "FETCH_FAILED":
      case "NETWORK_ERROR":
      case "TIMEOUT_ERROR":
        return "Unable to access the requested URL. Please try again later.";
      case "PARSING_ERROR":
        return "Unable to analyze the website content. Please try a different URL.";
      default:
        return "An unexpected error occurred. Please try again later.";
    }
  })();

  const statusCode = (() => {
    switch (error.type) {
      case "INVALID_REQUEST_BODY":
      case "MISSING_URL":
      case "INVALID_URL_FORMAT":
      case "URL_NOT_PERMITTED":
        return 400;
      case "TIMEOUT_ERROR":
        return 408;
      case "FETCH_FAILED":
        return error.message.includes("404") ? 404 : 502;
      default:
        return 500;
    }
  })();

  return Response.json(
    {
      success: false,
      error: userMessage,
      errorId, // Include error ID for support purposes
    },
    { status: statusCode },
  );
}

async function handleFeedSearch(request: Request): Promise<Response> {
  const result = await ResultAsync.fromPromise(
    request.json(),
    () =>
      ({
        type: "INVALID_REQUEST_BODY" as const,
        message: "Invalid JSON in request body",
      }) as ValidationError,
  )
    .andThen(parseRequestBody)
    .andThen(normalizeUrl)
    .andThen(validateTargetUrl)
    .andThen((validatedUrl) =>
      discoverFeeds(validatedUrl.href).map((feeds) => ({
        success: true,
        searchedUrl: validatedUrl.href,
        totalFound: feeds.length,
        feeds,
      })),
    );

  return result.match(
    (successData) => Response.json(successData),
    (error) => createErrorResponse(error),
  );
}

/**
 * Safe fetch wrapper with timeout and error handling
 */
function safeFetch(
  url: string,
  options: RequestInit = {},
): ResultAsync<Response, FeedDiscoveryError> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  return ResultAsync.fromPromise(
    fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "FeedFinder/1.0",
        ...options.headers,
      },
    }),
    (error): FeedDiscoveryError => {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            type: "TIMEOUT_ERROR" as const,
            message: `Request timeout for ${url}`,
          };
        }
        return {
          type: "NETWORK_ERROR" as const,
          message: `Network error: ${error.message}`,
        };
      }
      return {
        type: "NETWORK_ERROR" as const,
        message: "Unknown network error",
      };
    },
  ).andThen((response) => {
    clearTimeout(timeoutId);
    if (!response.ok) {
      return err({
        type: "FETCH_FAILED" as const,
        message: `HTTP ${response.status}`,
        status: response.status,
      });
    }
    return ok(response);
  });
}

function discoverFeeds(
  targetUrl: string,
): ResultAsync<FeedResult[], FeedDiscoveryError> {
  return validateTargetUrl(targetUrl)
    .mapErr(
      (validationError): FeedDiscoveryError => ({
        type: "FETCH_FAILED",
        message: validationError.message,
      }),
    )
    .asyncAndThen((validatedUrl) =>
      safeFetch(validatedUrl.href)
        .andThen((response) =>
          ResultAsync.fromPromise(
            response.text(),
            (): FeedDiscoveryError => ({
              type: "PARSING_ERROR",
              message: "Failed to parse response body",
            }),
          ),
        )
        .andThen((html) => {
          const feeds: FeedResult[] = [];
          const foundUrls = new Set<string>();

          // 1. Look for RSS autodiscovery links in HTML
          const metaFeeds = findMetaFeeds(html, validatedUrl.href);
          metaFeeds.forEach((feed) => {
            if (!foundUrls.has(feed.url)) {
              foundUrls.add(feed.url);
              feeds.push(feed);
            }
          });

          // 2. Try common feed paths
          return tryCommonPaths(validatedUrl.href).map((commonFeeds) => {
            commonFeeds.forEach((feed) => {
              if (!foundUrls.has(feed.url)) {
                foundUrls.add(feed.url);
                feeds.push(feed);
              }
            });
            return feeds;
          });
        }),
    );
}

/**
 * Extract feed links from HTML using secure string-based parsing
 * Completely avoids regex to prevent ReDoS vulnerabilities
 */
/**
 * Extract feed type title from MIME type
 */
function extractFeedTypeTitle(type: string): "RSS" | "Atom" {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("rss")) return "RSS";
  if (lowerType.includes("atom")) return "Atom";
  return "RSS"; // default fallback
}

/**
 * Fallback string parsing for HTML when node-html-parser fails
 */
function findMetaFeedsWithStringParsing(
  html: string,
  baseUrl: string,
): FeedResult[] {
  const feeds: FeedResult[] = [];
  const foundUrls = new Set<string>();

  // Helper function to process link sections
  const processLinkSections = (linkSections: string[]) => {
    for (let i = 1; i < linkSections.length; i++) {
      const feed = parseLinkSection(
        linkSections[i],
        SUPPORTED_FEED_TYPES,
        baseUrl,
      );
      if (feed && !foundUrls.has(feed.url)) {
        foundUrls.add(feed.url);
        feeds.push(feed);
      }
    }
  };

  // Split HTML by both <link and <LINK to find potential feed links (case insensitive)
  processLinkSections(html.split("<link"));
  processLinkSections(html.split("<LINK"));

  return feeds;
}

export function findMetaFeeds(html: string, baseUrl: string): FeedResult[] {
  const feeds: FeedResult[] = [];

  try {
    // Parse HTML using node-html-parser for maintainability and security
    const doc = parse(html);

    // Find all link elements with CSS selector
    const linkElements = doc.querySelectorAll("link");

    for (const link of linkElements) {
      const rel = link.getAttribute("rel");
      const type = link.getAttribute("type");
      const href = link.getAttribute("href");
      const title = link.getAttribute("title");

      // Check if this is a feed link
      if (
        rel?.split(/\s+/).some((t) => t.toLowerCase() === "alternate") &&
        type &&
        href &&
        SUPPORTED_FEED_TYPES.includes(type.toLowerCase().split(";")[0].trim())
      ) {
        try {
          const feedUrl = new URL(href, baseUrl).toString();
          feeds.push({
            title: title || DEFAULT_FEED_TITLE,
            url: feedUrl,
            type: extractFeedTypeTitle(type),
            discoveryMethod: "meta-tag" as const,
          });
        } catch {
          // Skip invalid URLs
          continue;
        }
      }
    }
  } catch {
    // Fallback to string parsing if HTML parsing fails
    return findMetaFeedsWithStringParsing(html, baseUrl);
  }

  return feeds;
}

/**
 * Parse a single link section and extract feed information if valid
 */
function parseLinkSection(
  section: string,
  feedTypes: string[],
  baseUrl: string,
): FeedResult | null {
  const endIndex = section.indexOf(">");

  // Security: Limit maximum tag length to prevent DoS attacks
  if (endIndex === -1 || endIndex > MAX_LINK_TAG_LENGTH) {
    return null;
  }

  const linkTag = "<link" + section.substring(0, endIndex + 1);

  // Early exit if not an alternate feed link
  if (!isAlternateFeedLink(linkTag)) {
    return null;
  }

  const feedInfo = extractFeedInfo(linkTag, feedTypes);
  if (!feedInfo.type || !feedInfo.href) {
    return null;
  }

  // Safe URL creation with Result type
  const urlResult = Result.fromThrowable(
    () => new URL(feedInfo.href!, baseUrl).href, // Non-null assertion is safe here due to null check above
    () => null, // Return null for invalid URLs to skip them
  )();

  if (!urlResult.isOk()) {
    return null;
  }

  return {
    url: urlResult.value,
    title: feedInfo.title || DEFAULT_FEED_TITLE,
    type: feedInfo.type.includes("atom") ? "Atom" : "RSS",
    discoveryMethod: "meta-tag",
  };
}

/**
 * Check if link tag is an alternate feed link
 */
function isAlternateFeedLink(linkTag: string): boolean {
  const lowerTag = linkTag.toLowerCase();
  // Extract rel attribute value and check if it contains "alternate"
  const relMatch = lowerTag.match(/rel=["']([^"']+)["']/);
  if (!relMatch) return false;

  const relValues = relMatch[1].split(/\s+/);
  return relValues.includes("alternate");
}

/**
 * Extract feed information from link tag using safe string operations
 */
function extractFeedInfo(
  linkTag: string,
  feedTypes: string[],
): {
  type: string | null;
  href: string | null;
  title: string | null;
} {
  const lowerTag = linkTag.toLowerCase();

  // Safe type detection with charset support
  let feedType: string | null = null;
  for (const type of feedTypes) {
    // Check for the type with potential charset parameters
    if (
      lowerTag.includes(`type="${type}`) ||
      lowerTag.includes(`type='${type}`)
    ) {
      feedType = type;
      break;
    }
  }

  // Safe attribute extraction
  const href = extractAttributeValue(linkTag, "href");
  const title = extractAttributeValue(linkTag, "title");

  return { type: feedType, href, title };
}

/**
 * Extract attribute value using safe string operations (no regex)
 */
export function extractAttributeValue(
  tag: string,
  attributeName: string,
): string | null {
  const lowerTag = tag.toLowerCase();
  const attrNameLower = attributeName.toLowerCase();
  const attrIndex = lowerTag.indexOf(attrNameLower);

  if (attrIndex === -1) return null;

  // Start searching after the attribute name
  let searchIndex = attrIndex + attrNameLower.length;

  // Skip whitespace characters (spaces and tabs) after attribute name
  while (
    searchIndex < tag.length &&
    (tag[searchIndex] === " " || tag[searchIndex] === "\t")
  ) {
    searchIndex++;
  }

  // Check if we found the equal sign
  if (searchIndex >= tag.length || tag[searchIndex] !== "=") {
    return null;
  }

  // Skip whitespace after equal sign
  searchIndex++; // Skip the '=' character
  while (
    searchIndex < tag.length &&
    (tag[searchIndex] === " " || tag[searchIndex] === "\t")
  ) {
    searchIndex++;
  }

  // Check for quote character
  const quote = tag[searchIndex];
  if (quote !== '"' && quote !== "'") return null;

  const valueContentStart = searchIndex + 1;
  const valueEnd = tag.indexOf(quote, valueContentStart);

  if (valueEnd === -1) return null;

  return tag.substring(valueContentStart, valueEnd);
}

// Security constants
const MAX_LINK_TAG_LENGTH = 1000;

function tryCommonPaths(
  baseUrl: string,
): ResultAsync<FeedResult[], FeedDiscoveryError> {
  const commonPaths = [
    "/feed",
    "/feeds",
    "/rss",
    "/rss.xml",
    "/feed.xml",
    "/atom.xml",
    "/index.xml",
  ];

  const feedPromises = commonPaths.map((path) => {
    // Safe URL creation with Result type
    const urlResult = Result.fromThrowable(
      () => new URL(path, baseUrl).href,
      () => null,
    )();

    if (urlResult.isErr()) {
      return ResultAsync.fromSafePromise(Promise.resolve(null));
    }

    const feedUrl = urlResult.value;

    // Validate each constructed URL to prevent SSRF
    return validateTargetUrl(feedUrl)
      .mapErr(
        (validationError): FeedDiscoveryError => ({
          type: "FETCH_FAILED",
          message: validationError.message,
        }),
      )
      .asyncAndThen(
        (validatedUrl) =>
          safeFetch(validatedUrl.href, { method: "HEAD" })
            .map((response) => {
              const contentType = response.headers.get("content-type") || "";
              if (
                contentType.includes("xml") ||
                contentType.includes("rss") ||
                contentType.includes("atom")
              ) {
                return {
                  url: validatedUrl.href,
                  title: `${path} feed`,
                  type: contentType.includes("atom") ? "Atom" : "RSS",
                  discoveryMethod: "common-path",
                } as FeedResult;
              }
              return null;
            })
            .orElse(() => ok(null)), // Convert errors to null (failed attempts are ok)
      )
      .orElse(() => ok(null)); // Convert validation errors to null
  });

  return ResultAsync.combine(feedPromises).map((results) =>
    results.filter((feed): feed is FeedResult => feed !== null),
  );
}

interface FeedResult {
  url: string;
  title: string;
  type: "RSS" | "Atom";
  description?: string;
  discoveryMethod: "meta-tag" | "common-path";
}
