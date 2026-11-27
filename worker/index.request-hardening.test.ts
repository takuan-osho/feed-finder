import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_REQUEST_BODY_BYTES, MAX_URL_LENGTH } from "./config";
import worker from "./index";

interface ErrorBody {
  success: false;
  error: string;
  errorId: string;
}

const ENDPOINT = "https://test.com/api/search-feeds";

const mockFetch = vi.fn();

const htmlResponse = (): Response =>
  new Response("<html><head></head></html>", {
    status: 200,
    headers: { "content-type": "text/html" },
  });

describe("POST /api/search-feeds request hardening", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 404 })),
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("Content-Type", () => {
    it("rejects a text/plain simple request with 415 and makes no outbound fetch", async () => {
      // A cross-origin <form>/fetch with text/plain skips the CORS preflight.
      const request = new Request(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          Origin: "https://evil.example",
        },
        body: JSON.stringify({ url: "https://victim.example" }),
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(415);
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      const body = (await response.json()) as ErrorBody;
      expect(body.success).toBe(false);
      expect(body.error).toBe(
        "Unsupported request format. Please send a JSON request.",
      );
      expect(JSON.stringify(body)).not.toContain("text/plain");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects a string body sent without an explicit content type (defaults to text/plain)", async () => {
      const request = new Request(ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ url: "https://victim.example" }),
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(415);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects a request with no content-type header at all", async () => {
      const request = new Request(ENDPOINT, {
        method: "POST",
        body: new Blob([JSON.stringify({ url: "https://victim.example" })]),
      });
      expect(request.headers.get("content-type")).toBeNull();

      const response = await worker.fetch(request);

      expect(response.status).toBe(415);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects application/x-www-form-urlencoded with 415", async () => {
      const request = new Request(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "url=https://victim.example",
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(415);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("accepts application/json with a charset parameter, case-insensitively", async () => {
      mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === "HEAD"
            ? new Response(null, { status: 404 })
            : htmlResponse(),
        ),
      );
      const request = new Request(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "Application/JSON; charset=UTF-8" },
        body: JSON.stringify({ url: "https://example.com" }),
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("body size", () => {
    it("rejects early with 413 when content-length exceeds the limit", async () => {
      const request = new Request(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(MAX_REQUEST_BODY_BYTES + 1),
        },
        body: JSON.stringify({ url: "https://example.com" }),
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(413);
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      const body = (await response.json()) as ErrorBody;
      expect(body.error).toBe(
        "Request is too large. Please shorten your input and try again.",
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects with 413 when the streamed body exceeds the limit", async () => {
      const padding = "a".repeat(MAX_REQUEST_BODY_BYTES);
      const request = new Request(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", padding }),
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(413);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("still returns 400 for malformed JSON within the limit", async () => {
      const request = new Request(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("URL length", () => {
    it("rejects a URL longer than MAX_URL_LENGTH with 400 and makes no outbound fetch", async () => {
      const url = "https://example.com/" + "a".repeat(MAX_URL_LENGTH);
      const request = new Request(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as ErrorBody;
      expect(body.error).toBe(
        "Invalid request. Please check your input and try again.",
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("accepts a URL of exactly MAX_URL_LENGTH", async () => {
      mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === "HEAD"
            ? new Response(null, { status: 404 })
            : htmlResponse(),
        ),
      );
      const url = "https://example.com/" + "a".repeat(MAX_URL_LENGTH - 20);
      expect(url.length).toBe(MAX_URL_LENGTH);
      const request = new Request(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
    });
  });
});
