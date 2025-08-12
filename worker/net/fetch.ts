import { err, ok, ResultAsync } from "neverthrow";
import { FETCH_TIMEOUT_MS, USER_AGENT } from "../config";
import type { FeedDiscoveryError } from "../types";

/**
 * Safe fetch wrapper with timeout and error handling
 */
export function safeFetch(
  url: string,
  options: RequestInit = {},
): ResultAsync<Response, FeedDiscoveryError> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  return ResultAsync.fromPromise(
    fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
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
