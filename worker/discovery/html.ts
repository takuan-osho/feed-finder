import { Result } from "neverthrow";
import { parse } from "node-html-parser";
import {
  DEFAULT_FEED_TITLE,
  MAX_LINK_TAG_LENGTH,
  SUPPORTED_FEED_TYPES,
} from "../config";
import type { FeedResult } from "../types";

/**
 * Extract feed type title from MIME type
 */
export function extractFeedTypeTitle(type: string): "RSS" | "Atom" {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("rss")) return "RSS";
  if (lowerType.includes("atom")) return "Atom";
  return "RSS"; // default fallback
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
 * Fallback string parsing for HTML when node-html-parser fails
 */
export function findMetaFeedsWithStringParsing(
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

  // Split HTML by <link tags (case insensitive) to find potential feed links
  const linkSections = html.split(/<link/gi);
  processLinkSections(linkSections);

  return feeds;
}

/**
 * Extract feed links from HTML using secure parsing
 */
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
