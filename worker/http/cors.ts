import { ALLOWED_ORIGINS } from "../config";

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

  // Prevent embedding in frames
  headers.set("X-Frame-Options", "DENY");

  // Control referrer information
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Basic Content Security Policy
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'none'; object-src 'none'",
  );

  // Add CORS headers with proper origin validation
  if (request) {
    const origin = request.headers.get("Origin");

    // Only set CORS headers for allowed origins
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
    }

    // Set other CORS headers
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400"); // 24 hours
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
  });

  return new Response(null, { status: 204, headers });
}
