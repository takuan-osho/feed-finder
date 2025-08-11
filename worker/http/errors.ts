import type { AppError } from "../types";

/**
 * Secure error response helper that prevents information leakage
 */
export function createErrorResponse(error: AppError): Response {
  // Log detailed error information for debugging (server-side only)
  const errorId = Math.random().toString(36).slice(2, 11);
  console.error(
    `[${errorId}] Error type: ${error.type}, Details: ${error.message}`,
  );

  // Return generic user-friendly message to prevent information disclosure
  const userMessage = (() => {
    switch (error.type) {
      case "INVALID_REQUEST_BODY":
      case "MISSING_URL":
      case "INVALID_URL_FORMAT":
      case "URL_NOT_PERMITTED":
        return "Invalid request. Please check your input and try again.";
      case "FETCH_FAILED":
      case "NETWORK_ERROR":
      case "TIMEOUT_ERROR":
        return "Unable to access the requested URL. Please try again later.";
      case "PARSING_ERROR":
        return "Unable to analyze the website content. Please try a different URL.";
      default:
        return "An unexpected error occurred. Please try again later.";
    }
  })();

  const statusCode = (() => {
    switch (error.type) {
      case "INVALID_REQUEST_BODY":
      case "MISSING_URL":
      case "INVALID_URL_FORMAT":
      case "URL_NOT_PERMITTED":
        return 400;
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
