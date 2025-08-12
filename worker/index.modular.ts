import { ResultAsync } from "neverthrow";
import { discoverFeeds } from "./discovery";
import { addSecurityHeaders, handleCorsPreflightRequest } from "./http/cors";
import { createErrorResponse } from "./http/errors";
import type { ValidationError } from "./types";
import { normalizeUrl, parseRequestBody } from "./validation/request";
import { validateTargetUrl } from "./validation/url";

/**
 * Handle feed search requests
 */
async function handleFeedSearch(request: Request): Promise<Response> {
  const result = await ResultAsync.fromPromise(
    request.json(),
    () =>
      ({
        type: "INVALID_REQUEST_BODY" as const,
        message: "Invalid JSON in request body",
      }) as ValidationError,
  )
    .andThen(parseRequestBody)
    .andThen(normalizeUrl)
    .andThen(validateTargetUrl)
    .andThen((validatedUrl) =>
      discoverFeeds(validatedUrl.href).map((feeds) => ({
        success: true,
        searchedUrl: validatedUrl.href,
        totalFound: feeds.length,
        feeds,
      })),
    );

  return result.match(
    (successData) => Response.json(successData),
    (error) => createErrorResponse(error),
  );
}

/**
 * Main Worker entry point
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return handleCorsPreflightRequest(request);
    }

    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/search-feeds" && request.method === "POST") {
        const response = await handleFeedSearch(request);
        return addSecurityHeaders(response, request);
      }
      const notFoundResponse = new Response("Not Found", { status: 404 });
      return addSecurityHeaders(notFoundResponse, request);
    }
    const notFoundResponse = new Response(null, { status: 404 });
    return addSecurityHeaders(notFoundResponse, request);
  },
};
