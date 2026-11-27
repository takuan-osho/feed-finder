import { logger } from "../observability/logger";
import type { AppError } from "../types";

/**
 * Secure error response helper that prevents information leakage
 */
const GENERIC_ERROR_MESSAGE =
  "An unexpected error occurred. Please try again later.";
const ERROR_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ERROR_ID_LENGTH = 9;
const MAX_UNBIASED_BYTE = 252;

export function generateErrorId(): string {
  let errorId = "";

  while (errorId.length < ERROR_ID_LENGTH) {
    const bytes = new Uint8Array(ERROR_ID_LENGTH);
    crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= MAX_UNBIASED_BYTE) {
        continue;
      }

      errorId += ERROR_ID_ALPHABET[byte % ERROR_ID_ALPHABET.length];

      if (errorId.length === ERROR_ID_LENGTH) {
        break;
      }
    }
  }

  return errorId;
}

export function createErrorResponse(error: AppError): Response {
  // Log detailed error information for debugging (server-side only)
  const errorId = generateErrorId();
  logger.error(
    {
      error_id: errorId,
      error_type: error.type,
      details: error.message,
    },
    "error_response",
  );

  // Return generic user-friendly message to prevent information disclosure
  const userMessage = (() => {
    switch (error.type) {
      case "INVALID_REQUEST_BODY":
      case "MISSING_URL":
      case "INVALID_URL_FORMAT":
      case "URL_NOT_PERMITTED":
      case "URL_TOO_LONG":
        return "Invalid request. Please check your input and try again.";
      case "PAYLOAD_TOO_LARGE":
        return "Request is too large. Please shorten your input and try again.";
      case "UNSUPPORTED_MEDIA_TYPE":
        return "Unsupported request format. Please send a JSON request.";
      case "FETCH_FAILED":
      case "NETWORK_ERROR":
      case "TIMEOUT_ERROR":
        return "Unable to access the requested URL. Please try again later.";
      case "PARSING_ERROR":
        return "Unable to analyze the website content. Please try a different URL.";
      default:
        return GENERIC_ERROR_MESSAGE;
    }
  })();

  const statusCode = (() => {
    switch (error.type) {
      case "INVALID_REQUEST_BODY":
      case "MISSING_URL":
      case "INVALID_URL_FORMAT":
      case "URL_NOT_PERMITTED":
      case "URL_TOO_LONG":
        return 400;
      case "PAYLOAD_TOO_LARGE":
        return 413;
      case "UNSUPPORTED_MEDIA_TYPE":
        return 415;
      case "TIMEOUT_ERROR":
        return 408;
      case "FETCH_FAILED":
        return error.message.includes("404") ? 404 : 502;
      default:
        return 500;
    }
  })();

  return Response.json(
    {
      success: false,
      error: userMessage,
      errorId, // Include error ID for support purposes
    },
    { status: statusCode },
  );
}

/**
 * Converts an exception that escaped the request handler into a generic 500.
 * The name, message and stack go to the log only, never to the client.
 */
export function createUnhandledExceptionResponse(
  error: unknown,
  requestId?: string,
): Response {
  const errorId = generateErrorId();
  const isError = error instanceof Error;
  logger.error(
    {
      error_id: errorId,
      error_name: isError ? error.name : "NonError",
      error_message: isError ? error.message : String(error),
      ...(isError && error.stack !== undefined ? { stack: error.stack } : {}),
      ...(requestId !== undefined ? { request_id: requestId } : {}),
    },
    "unhandled_exception",
  );

  return Response.json(
    { success: false, error: GENERIC_ERROR_MESSAGE, errorId },
    { status: 500 },
  );
}
