import { describe, expect, it } from "vitest";
import { addSecurityHeaders, handleCorsPreflightRequest } from "./cors";

describe("http/cors", () => {
  describe("addSecurityHeaders", () => {
    it("should add security headers to response", () => {
      const originalResponse = new Response("test content", { status: 200 });
      const request = new Request("https://example.com");

      const result = addSecurityHeaders(originalResponse, request);

      expect(result.status).toBe(200);
      expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(result.headers.get("X-Frame-Options")).toBeNull();
      expect(result.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(result.headers.get("Content-Security-Policy")).toBe(
        "default-src 'none'; script-src 'none'; object-src 'none'; frame-ancestors 'none'",
      );
    });

    it("should add CORS headers for allowed origins", () => {
      const originalResponse = new Response("test", { status: 200 });
      const request = new Request("https://example.com", {
        headers: {
          Origin: "http://localhost:5173",
        },
      });

      const result = addSecurityHeaders(originalResponse, request);

      expect(result.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:5173",
      );
      expect(result.headers.get("Access-Control-Allow-Methods")).toBe(
        "POST, OPTIONS",
      );
      expect(result.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type",
      );
      expect(result.headers.get("Access-Control-Max-Age")).toBe("86400");
    });

    it("should not add CORS headers for disallowed origins", () => {
      const originalResponse = new Response("test", { status: 200 });
      const request = new Request("https://example.com", {
        headers: {
          Origin: "https://evil.example.com",
        },
      });

      const result = addSecurityHeaders(originalResponse, request);

      expect(result.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(result.headers.get("Access-Control-Allow-Methods")).toBe(
        "POST, OPTIONS",
      );
      expect(result.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type",
      );
      expect(result.headers.get("Access-Control-Max-Age")).toBe("86400");
    });

    it("should handle requests without origin header", () => {
      const originalResponse = new Response("test", { status: 200 });
      const request = new Request("https://example.com");

      const result = addSecurityHeaders(originalResponse, request);

      expect(result.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(result.headers.get("Access-Control-Allow-Methods")).toBe(
        "POST, OPTIONS",
      );
    });

    it("should work without request parameter", () => {
      const originalResponse = new Response("test", { status: 200 });

      const result = addSecurityHeaders(originalResponse);

      expect(result.status).toBe(200);
      expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(result.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("should preserve original response body and status", () => {
      const originalResponse = new Response("original content", {
        status: 201,
        statusText: "Created",
      });

      const result = addSecurityHeaders(originalResponse);

      expect(result.status).toBe(201);
      expect(result.statusText).toBe("Created");
      expect(result.body).toBe(originalResponse.body);
    });

    it("should preserve existing headers while adding security headers", () => {
      const originalResponse = new Response("test", {
        status: 200,
        headers: {
          "Custom-Header": "custom-value",
          "Content-Type": "text/plain",
        },
      });

      const result = addSecurityHeaders(originalResponse);

      expect(result.headers.get("Custom-Header")).toBe("custom-value");
      expect(result.headers.get("Content-Type")).toBe("text/plain");
      expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });

  describe("handleCorsPreflightRequest", () => {
    it("should handle valid preflight request", () => {
      const request = new Request("https://api.example.com", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
        },
      });

      const result = handleCorsPreflightRequest(request);

      expect(result.status).toBe(204);
      expect(result.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:5173",
      );
      expect(result.headers.get("Access-Control-Allow-Methods")).toBe(
        "POST, OPTIONS",
      );
      expect(result.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type",
      );
      expect(result.headers.get("Access-Control-Max-Age")).toBe("86400");
    });

    it("should reject preflight request from disallowed origin", () => {
      const request = new Request("https://api.example.com", {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example.com",
        },
      });

      const result = handleCorsPreflightRequest(request);

      expect(result.status).toBe(403);
    });

    it("should reject preflight request without origin", () => {
      const request = new Request("https://api.example.com", {
        method: "OPTIONS",
      });

      const result = handleCorsPreflightRequest(request);

      expect(result.status).toBe(403);
    });

    it("should handle all allowed origins", () => {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://feedfinder.programarch.com",
        "https://feedfinder.takuan-osho.com",
        "https://feedfinder.takuan-osho.net",
      ];

      allowedOrigins.forEach((origin) => {
        const request = new Request("https://api.example.com", {
          method: "OPTIONS",
          headers: {
            Origin: origin,
          },
        });

        const result = handleCorsPreflightRequest(request);

        expect(result.status).toBe(204);
        expect(result.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      });
    });
  });
});
