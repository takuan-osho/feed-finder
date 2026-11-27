import { err, ok, okAsync, Result, ResultAsync } from "neverthrow";

import {
  FETCH_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  USER_AGENT,
} from "../config";
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
 * Runs an operation under a single FETCH_TIMEOUT_MS deadline.
 * The timer is cleared when the operation settles either way.
 */
function withTimeout<T>(
  run: (signal: AbortSignal) => ResultAsync<T, FeedDiscoveryError>,
): ResultAsync<T, FeedDiscoveryError> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return run(controller.signal)
    .andTee(() => clearTimeout(timeoutId))
    .orTee(() => clearTimeout(timeoutId));
}

/**
 * Fetches a URL, following and re-validating redirects manually.
 * Non-2xx final responses become FETCH_FAILED errors.
 */
function fetchFollowingRedirects(
  url: string,
  options: RequestInit,
  signal: AbortSignal,
): ResultAsync<Response, FeedDiscoveryError> {
  const init: RequestInit = {
    ...options,
    redirect: "manual",
    signal,
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

  return follow(url, MAX_REDIRECTS).andThen((response) => {
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

/**
 * Safe fetch wrapper with timeout and error handling.
 *
 * Redirects are followed manually (up to MAX_REDIRECTS) so that every hop is
 * re-validated with validateTargetUrl; otherwise a public URL could redirect
 * to an internal address. A single timeout covers the whole redirect chain.
 * The timeout does not cover reading the body; use fetchText for that.
 */
export function safeFetch(
  url: string,
  options: RequestInit = {},
): ResultAsync<Response, FeedDiscoveryError> {
  return withTimeout((signal) => fetchFollowingRedirects(url, options, signal));
}

const bodyTimeout = (): FeedDiscoveryError => ({
  type: "TIMEOUT_ERROR" as const,
  message: "Timed out while reading response body",
});

async function readBody(
  response: Response,
  maxBytes: number,
  signal: AbortSignal | undefined,
): Promise<Result<string, FeedDiscoveryError>> {
  const body = response.body;
  if (body === null) {
    return ok("");
  }

  const reader = body.getReader();
  const cancel = () => {
    reader.cancel().catch(() => {});
  };
  const decoder = new TextDecoder();
  let text = "";
  let received = 0;

  // Resolves (never rejects) on abort so it can be raced against reads
  let onAbort = () => {};
  const aborted = new Promise<"aborted">((resolve) => {
    onAbort = () => resolve("aborted");
    signal?.addEventListener("abort", onAbort, { once: true });
  });

  try {
    while (true) {
      if (signal?.aborted) {
        cancel();
        return err(bodyTimeout());
      }
      const chunk = await Promise.race([reader.read(), aborted]);
      if (chunk === "aborted") {
        cancel();
        return err(bodyTimeout());
      }
      if (chunk.done) {
        return ok(text + decoder.decode());
      }
      const remaining = maxBytes - received;
      if (chunk.value.byteLength > remaining) {
        // Truncate instead of failing: <link> tags live in <head>
        cancel();
        return ok(text + decoder.decode(chunk.value.subarray(0, remaining)));
      }
      received += chunk.value.byteLength;
      text += decoder.decode(chunk.value, { stream: true });
    }
  } catch {
    cancel();
    return err(
      signal?.aborted
        ? bodyTimeout()
        : {
            type: "PARSING_ERROR" as const,
            message: "Failed to read response body",
          },
    );
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Reads a response body as UTF-8 text, stopping after maxBytes.
 * Bodies over the limit are truncated and the rest of the stream is
 * cancelled. An abort of `signal` yields TIMEOUT_ERROR and a stream error
 * yields PARSING_ERROR.
 */
export function readBodyWithLimit(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
): ResultAsync<string, FeedDiscoveryError> {
  return new ResultAsync(readBody(response, maxBytes, signal));
}

/**
 * Whether a Content-Type may hold an HTML/XML document worth parsing.
 * A missing Content-Type is treated as text.
 */
export function isTextLikeContentType(contentType: string | null): boolean {
  if (!contentType) {
    return true;
  }
  const type = contentType.toLowerCase();
  return (
    type.startsWith("text/") || type.includes("html") || type.includes("xml")
  );
}

/**
 * Fetches a page and reads at most MAX_RESPONSE_BYTES of its body.
 * One FETCH_TIMEOUT_MS deadline covers redirects and the body read.
 * Returns null (after cancelling the body) when the Content-Type is clearly
 * not text.
 */
export function fetchText(
  url: string,
): ResultAsync<string | null, FeedDiscoveryError> {
  return withTimeout((signal) =>
    fetchFollowingRedirects(url, {}, signal).andThen(
      (response): ResultAsync<string | null, FeedDiscoveryError> => {
        if (!isTextLikeContentType(response.headers.get("content-type"))) {
          discardBody(response);
          return okAsync(null);
        }
        return readBodyWithLimit(response, MAX_RESPONSE_BYTES, signal);
      },
    ),
  );
}
