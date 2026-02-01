/**
 * Shared type definitions for frontend and backend
 */

/**
 * Feed result interface
 * Represents a discovered feed from a website
 */
export interface FeedResult {
  /** The URL of the feed */
  url: string;
  /** The title of the feed (optional - may not be available from meta tags) */
  title?: string;
  /** The type of feed (RSS or Atom) */
  type: "RSS" | "Atom";
  /** Optional description of the feed */
  description?: string;
  /** How the feed was discovered */
  discoveryMethod: "meta-tag" | "common-path";
}

/**
 * Search result interface
 * Represents the result of a feed search operation
 */
export interface SearchResult {
  /** Whether the search was successful */
  success: boolean;
  /** Array of discovered feeds */
  feeds: FeedResult[];
  /** The URL that was searched */
  searchedUrl: string;
  /** Total number of feeds found */
  totalFound: number;
  /** Optional message (e.g., for additional context or errors) */
  message?: string;
}
