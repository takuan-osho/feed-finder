import { ResultAsync } from "neverthrow";

import { fetchText } from "../net/fetch";
import type { FeedDiscoveryError, FeedResult } from "../types";
import { validateTargetUrl } from "../validation/url";
import { tryCommonPaths } from "./commonPaths";
import { findMetaFeeds } from "./html";

/**
 * Discover feeds from a target URL using multiple strategies
 */
export function discoverFeeds(
  targetUrl: string,
): ResultAsync<FeedResult[], FeedDiscoveryError> {
  return validateTargetUrl(targetUrl)
    .mapErr((validationError): FeedDiscoveryError => ({
      type: "FETCH_FAILED",
      message: validationError.message,
    }))
    .asyncAndThen((validatedUrl) => {
      // Run HTML fetch and common paths discovery in parallel
      // fetchText bounds the body size and keeps the timeout running while
      // the body is read; non-text responses yield null (no meta feeds)
      const htmlFetchPromise = fetchText(validatedUrl.href).map((html) =>
        html === null ? [] : findMetaFeeds(html, validatedUrl.href),
      );

      const commonPathsPromise = tryCommonPaths(validatedUrl.href);

      // Combine both approaches in parallel
      return ResultAsync.combine([htmlFetchPromise, commonPathsPromise])
        .map(([metaFeeds, commonFeeds]) => {
          const feeds: FeedResult[] = [];
          const foundUrls = new Set<string>();

          // Add meta feeds first
          metaFeeds.forEach((feed) => {
            if (!foundUrls.has(feed.url)) {
              foundUrls.add(feed.url);
              feeds.push(feed);
            }
          });

          // Add common path feeds
          commonFeeds.forEach((feed) => {
            if (!foundUrls.has(feed.url)) {
              foundUrls.add(feed.url);
              feeds.push(feed);
            }
          });

          return feeds;
        })
        .orElse(() => {
          // Fallback: if HTML fetch fails, try only common paths
          return tryCommonPaths(validatedUrl.href);
        });
    });
}
