import { err, ok, Result, ResultAsync } from "neverthrow";

import { MAX_REQUEST_BODY_BYTES, MAX_URL_LENGTH } from "../config";
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
    .mapErr((): ValidationError => ({
      type: "INVALID_URL_FORMAT" as const,
      message: "Invalid URL format",
    }));
}

/**
 * Requires `Content-Type: application/json` (parameters such as charset are
 * allowed). Rejecting the CORS-safelisted types (text/plain, form encodings)
 * forces browsers to send a preflight, which is checked against
 * ALLOWED_ORIGINS.
 */
export function checkJsonContentType(
  headers: Headers,
): Result<Headers, ValidationError> {
  const raw = headers.get("content-type") ?? "";
  const mediaType = (raw.split(";")[0] ?? "").trim().toLowerCase();
  if (mediaType !== "application/json") {
    return err({
      type: "UNSUPPORTED_MEDIA_TYPE" as const,
      message: `Unsupported content-type: ${raw.slice(0, 100)}`,
    });
  }
  return ok(headers);
}

/**
 * Rejects early when the declared Content-Length exceeds the limit.
 * A missing or malformed header is allowed through; readJsonBody enforces
 * the limit on the bytes actually received.
 */
export function checkContentLength(
  headers: Headers,
  maxBytes: number = MAX_REQUEST_BODY_BYTES,
): Result<Headers, ValidationError> {
  const raw = headers.get("content-length");
  if (raw === null || !/^\d+$/.test(raw.trim())) {
    return ok(headers);
  }
  const declared = Number(raw.trim());
  if (declared > maxBytes) {
    return err({
      type: "PAYLOAD_TOO_LARGE" as const,
      message: `Declared content-length ${declared} exceeds ${maxBytes} bytes`,
    });
  }
  return ok(headers);
}

class BodyTooLargeError extends Error {}

async function readTextWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError(`Request body exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Reads the request body as JSON, stopping as soon as more than `maxBytes`
 * have been received (Content-Length may be absent or wrong).
 */
export function readJsonBody(
  request: Request,
  maxBytes: number = MAX_REQUEST_BODY_BYTES,
): ResultAsync<unknown, ValidationError> {
  return ResultAsync.fromPromise(
    readTextWithLimit(request.body, maxBytes),
    (error): ValidationError =>
      error instanceof BodyTooLargeError
        ? { type: "PAYLOAD_TOO_LARGE" as const, message: error.message }
        : {
            type: "INVALID_REQUEST_BODY" as const,
            message: "Failed to read request body",
          },
  ).andThen((text) =>
    Result.fromThrowable(
      (): unknown => JSON.parse(text),
      (): ValidationError => ({
        type: "INVALID_REQUEST_BODY" as const,
        message: "Invalid JSON in request body",
      }),
    )(),
  );
}

/**
 * Rejects URLs longer than MAX_URL_LENGTH characters.
 */
export function checkUrlLength(
  url: string,
  maxLength: number = MAX_URL_LENGTH,
): Result<string, ValidationError> {
  if (url.length > maxLength) {
    return err({
      type: "URL_TOO_LONG" as const,
      message: `URL length ${url.length} exceeds ${maxLength}`,
    });
  }
  return ok(url);
}
