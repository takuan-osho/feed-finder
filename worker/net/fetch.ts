import { err, ok, Result, ResultAsync } from "neverthrow";

import { FETCH_TIMEOUT_MS, MAX_REDIRECTS, USER_AGENT } from "../config";
import type { FeedDiscoveryError } from "../types";
import { validateTargetUrl } from "../validation/url";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const fetchFailed = (message: string): FeedDiscoveryError => ({
  type: "FETCH_FAILED" as const,
  message,
});

const resolveLocation = Result.fromThrowable(
  (location: string, base: string) => new URL(location, base).href,
  () => fetchFailed("Invalid redirect location"),
);

/** Discard a redirect response body so the connection can be released. */
function discardBody(response: Response): void {
  response.body?.cancel().catch(() => {});
}

/**
 * Resolves and validates the next hop of a redirect.
 * The redirect target goes through the same SSRF checks as the original URL.
 */
function nextHop(
  response: Response,
  currentUrl: string,
): Result<string, FeedDiscoveryError> {
  const location = response.headers.get("location");
  if (location === null) {
    return err(fetchFailed("Redirect without Location header"));
  }
  return resolveLocation(location, currentUrl).andThen((target) =>
    validateTargetUrl(target)
      .map((url) => url.href)
      .mapErr((validationError) =>
        fetchFailed(
          `Redirect target not permitted: ${validationError.message}`,
        ),
      ),
  );
}

/**
 * Safe fetch wrapper with timeout and error handling.
 *
 * Redirects are followed manually (up to MAX_REDIRECTS) so that every hop is
 * re-validated with validateTargetUrl; otherwise a public URL could redirect
 * to an internal address. A single timeout covers the whole redirect chain.
 */
export function safeFetch(
  url: string,
  options: RequestInit = {},
): ResultAsync<Response, FeedDiscoveryError> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const init: RequestInit = {
    ...options,
    redirect: "manual",
    signal: controller.signal,
    headers: {
      "User-Agent": USER_AGENT,
      ...options.headers,
    },
  };

  const fetchHop = (
    hopUrl: string,
  ): ResultAsync<Response, FeedDiscoveryError> =>
    ResultAsync.fromPromise(
      fetch(hopUrl, init),
      (error): FeedDiscoveryError => {
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
    );

  const follow = (
    hopUrl: string,
    redirectsLeft: number,
  ): ResultAsync<Response, FeedDiscoveryError> =>
    fetchHop(hopUrl).andThen((response) => {
      if (!REDIRECT_STATUSES.has(response.status)) {
        return ok(response);
      }
      discardBody(response);
      if (redirectsLeft === 0) {
        return err(fetchFailed(`Too many redirects (max ${MAX_REDIRECTS})`));
      }
      return nextHop(response, hopUrl).asyncAndThen((target) =>
        follow(target, redirectsLeft - 1),
      );
    });

  return follow(url, MAX_REDIRECTS)
    .andTee(() => clearTimeout(timeoutId))
    .orTee(() => clearTimeout(timeoutId))
    .andThen((response) => {
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
