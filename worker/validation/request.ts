import { err, ok, Result } from "neverthrow";
import type { ValidationError } from "../types";
import { safeCreateUrl } from "./url";

/**
 * Parses and validates request body
 */
export function parseRequestBody(
  body: unknown,
): Result<string, ValidationError> {
  if (!body || typeof body !== "object") {
    return err({
      type: "INVALID_REQUEST_BODY" as const,
      message: "Invalid request body",
    });
  }

  const { url: targetUrl } = body as { url?: unknown };
  if (!targetUrl || typeof targetUrl !== "string" || targetUrl.trim() === "") {
    return err({
      type: "MISSING_URL" as const,
      message: "URL is required",
    });
  }

  return ok(targetUrl);
}

/**
 * Normalizes URL by adding https if no protocol is specified
 */
export function normalizeUrl(url: string): Result<string, ValidationError> {
  // Handle edge cases first
  if (!url || url.trim() === "") {
    return err({
      type: "INVALID_URL_FORMAT" as const,
      message: "Invalid URL format",
    });
  }

  // Special handling for obviously invalid formats
  if (
    url.includes("://") &&
    !url.startsWith("http://") &&
    !url.startsWith("https://")
  ) {
    return err({
      type: "INVALID_URL_FORMAT" as const,
      message: "Invalid URL format",
    });
  }

  // Handle incomplete URLs
  if (url === "http:/" || url === "https:/" || url.endsWith("://")) {
    return err({
      type: "INVALID_URL_FORMAT" as const,
      message: "Invalid URL format",
    });
  }

  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  // Validate that the normalized URL is properly formed
  return safeCreateUrl(normalizedUrl)
    .map(() => normalizedUrl)
    .mapErr(
      (): ValidationError => ({
        type: "INVALID_URL_FORMAT" as const,
        message: "Invalid URL format",
      }),
    );
}
