import { ok, Result, ResultAsync } from "neverthrow";
import { safeFetch } from "../net/fetch";
import type { FeedDiscoveryError, FeedResult } from "../types";
import { validateTargetUrl } from "../validation/url";

/**
 * Try to discover feeds from common feed paths
 */
export function tryCommonPaths(
  baseUrl: string,
): ResultAsync<FeedResult[], FeedDiscoveryError> {
  // Root level paths (absolute from domain root)
  const rootPaths = [
    "/feed",
    "/feeds",
    "/rss",
    "/rss.xml",
    "/feed.xml",
    "/atom.xml",
    "/index.xml",
  ];

  // Relative paths from current URL path (Issue #35)
  const relativePaths = [
    "feed/",
    "feeds/",
    "rss/",
    "feed.xml",
    "rss.xml",
    "atom.xml",
    "index.xml",
  ];

  const commonPaths = [...rootPaths, ...relativePaths];

  // Create all feed URLs first and filter valid ones
  const validFeedUrls = commonPaths
    .map((path) => {
      const urlResult = Result.fromThrowable(
        () => new URL(path, baseUrl).href,
        () => null,
      )();

      if (urlResult.isErr()) return null;

      const feedUrl = urlResult.value;
      const validation = validateTargetUrl(feedUrl);
      return validation.isOk() ? { path, url: validation.value.href } : null;
    })
    .filter((item): item is { path: string; url: string } => item !== null);

  // Process all valid URLs in parallel using Promise.all()
  // Use HEAD requests for efficient content-type checking
  const feedPromises = validFeedUrls.map(
    ({ path, url }) =>
      safeFetch(url, { method: "HEAD" })
        .map((response) => {
          const contentType = response.headers.get("content-type") || "";
          // More specific content-type checking to reduce false positives
          const isFeed =
            /^(application\/(rss|atom|rdf)\+xml|text\/xml|application\/xml)/.test(
              contentType.toLowerCase(),
            );

          if (isFeed) {
            return {
              url,
              title: `${path} feed`,
              type: contentType.includes("atom") ? "Atom" : "RSS",
              discoveryMethod: "common-path",
            } as FeedResult;
          }
          return null;
        })
        .orElse(() => ok(null)), // Convert errors to null (failed attempts are ok)
  );

  return ResultAsync.combine(feedPromises).map((results) =>
    results.filter((feed): feed is FeedResult => feed !== null),
  );
}
