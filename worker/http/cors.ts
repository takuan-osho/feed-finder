import { ALLOWED_ORIGINS } from "../config";

/**
 * Appends `Origin` to the Vary header unless it is already listed.
 * The Access-Control-Allow-Origin value depends on the request Origin, so
 * shared caches must not reuse a response across origins.
 */
function addVaryOrigin(headers: Headers): void {
  const vary = headers.get("Vary");
  const alreadyVariesOnOrigin = vary
    ?.split(",")
    .some((value) => value.trim().toLowerCase() === "origin");

  if (!alreadyVariesOnOrigin) {
    headers.set("Vary", vary ? `${vary}, Origin` : "Origin");
  }
}

/**
 * Adds security headers and CORS headers to the response
 */
export function addSecurityHeaders(
  response: Response,
  request?: Request,
): Response {
  const headers = new Headers(response.headers);

  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff");

  // Control referrer information
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Comprehensive Content Security Policy with frame protection
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'none'; object-src 'none'; frame-ancestors 'none'",
  );

  // Tell browsers to use HTTPS only for this host (one year)
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );

  addVaryOrigin(headers);

  // Add CORS headers with proper origin validation
  if (request) {
    const origin = request.headers.get("Origin");

    // Only set CORS headers for allowed origins
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Handles preflight CORS requests
 */
export function handleCorsPreflightRequest(request: Request): Response {
  const origin = request.headers.get("Origin");

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  const headers = new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });

  return new Response(null, { status: 204, headers });
}
