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
 * Network configuration
 */
export const USER_AGENT = "FeedFinder/1.0";
export const FETCH_TIMEOUT_MS = 5000;
