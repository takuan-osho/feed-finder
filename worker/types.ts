/**
 * Error types for type-safe error handling
 */
export type ValidationError =
  | { type: "INVALID_REQUEST_BODY"; message: string }
  | { type: "MISSING_URL"; message: string }
  | { type: "INVALID_URL_FORMAT"; message: string }
  | { type: "URL_NOT_PERMITTED"; message: string };

export type FeedDiscoveryError =
  | { type: "FETCH_FAILED"; message: string; status?: number }
  | { type: "NETWORK_ERROR"; message: string }
  | { type: "TIMEOUT_ERROR"; message: string }
  | { type: "PARSING_ERROR"; message: string };

export type AppError = ValidationError | FeedDiscoveryError;

/**
 * Feed result interface
 */
export interface FeedResult {
  url: string;
  title: string;
  type: "RSS" | "Atom";
  description?: string;
  discoveryMethod: "meta-tag" | "common-path";
}
