/**
 * Default title for feeds when no title is found in meta tags
 */
export const DEFAULT_FEED_TITLE = "RSS/Atom feed";

/**
 * Supported feed MIME types for detection
 * Note: Generic XML types (text/xml, application/xml) fall back to RSS.
 */
export const SUPPORTED_FEED_TYPES = [
  "application/rss+xml",
  "application/atom+xml",
  "application/rdf+xml", // RSS 1.0 (RDF)
  "text/xml",
  "application/xml",
];

/**
 * Allowed origins for CORS requests
 */
export const ALLOWED_ORIGINS = [
  "http://localhost:5173", // Vite dev server
  "http://localhost:3000", // Common dev port
  "https://feedfinder.programarch.com", // Another production domain
  "https://feedfinder.takuan-osho.com", // Another production domain
  "https://feedfinder.takuan-osho.net", // Another production domain
];

/**
 * Security constants
 */
export const MAX_LINK_TAG_LENGTH = 1000;

/**
 * Request limits for POST /api/search-feeds
 */
export const MAX_REQUEST_BODY_BYTES = 8 * 1024; // 8 KiB
export const MAX_URL_LENGTH = 2048;

/**
 * Network configuration
 */
export const USER_AGENT = "FeedFinder/1.0";
export const FETCH_TIMEOUT_MS = 5000;

/**
 * Maximum number of redirects followed by safeFetch.
 * Every hop is re-validated with validateTargetUrl.
 */
export const MAX_REDIRECTS = 5;

/**
 * Maximum number of response body bytes read when parsing a page.
 * Larger bodies are truncated (feed <link> tags live in <head>).
 */
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
