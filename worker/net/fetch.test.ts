import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeFetch } from "./fetch";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("net/fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("safeFetch", () => {
    it("should successfully fetch a valid response", async () => {
      const mockResponse = new Response("test content", { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await safeFetch("https://example.com");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(mockResponse);
        expect(result.value.status).toBe(200);
      }

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "FeedFinder/1.0",
          }),
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("should include custom headers with User-Agent", async () => {
      const mockResponse = new Response("test", { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const customOptions = {
        headers: {
          Accept: "application/xml",
        },
      };

      await safeFetch("https://example.com", customOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: {
            "User-Agent": "FeedFinder/1.0",
            Accept: "application/xml",
          },
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("should timeout after configured timeout period", async () => {
      // Mock setTimeout to immediately call the callback
      vi.spyOn(global, "setTimeout").mockImplementation((callback) => {
        // Call callback immediately to simulate timeout
        if (typeof callback === "function") {
          callback();
        }
        return 1 as any;
      });

      // Mock fetch to return a promise that gets aborted
      let abortController: AbortController | undefined;
      mockFetch.mockImplementation((_url, options) => {
        abortController = new AbortController();
        // Simulate the signal being aborted
        if (options?.signal) {
          (options.signal as AbortSignal).addEventListener("abort", () => {
            abortController?.abort();
          });
        }
        // Return a promise that gets rejected with AbortError
        return Promise.reject(
          Object.assign(new Error("AbortError"), { name: "AbortError" }),
        );
      });

      const result = await safeFetch("https://example.com");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("TIMEOUT_ERROR");
        expect(result.error.message).toBe(
          "Request timeout for https://example.com",
        );
      }
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network connection failed");
      mockFetch.mockRejectedValueOnce(networkError);

      const result = await safeFetch("https://example.com");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("NETWORK_ERROR");
        expect(result.error.message).toBe(
          "Network error: Network connection failed",
        );
      }
    });

    it("should handle AbortError as timeout", async () => {
      const abortError = new Error("AbortError");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await safeFetch("https://example.com");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("TIMEOUT_ERROR");
        expect(result.error.message).toBe(
          "Request timeout for https://example.com",
        );
      }
    });

    it("should handle unknown error types", async () => {
      mockFetch.mockRejectedValueOnce("string error");

      const result = await safeFetch("https://example.com");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("NETWORK_ERROR");
        expect(result.error.message).toBe("Unknown network error");
      }
    });

    it("should handle HTTP error status codes", async () => {
      const mockResponse = new Response("Not Found", { status: 404 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await safeFetch("https://example.com");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FETCH_FAILED");
        expect(result.error.message).toBe("HTTP 404");
        if (result.error.type === "FETCH_FAILED") {
          expect(result.error.status).toBe(404);
        }
      }
    });

    it("should handle HTTP 500 error", async () => {
      const mockResponse = new Response("Internal Server Error", {
        status: 500,
      });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await safeFetch("https://example.com");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FETCH_FAILED");
        expect(result.error.message).toBe("HTTP 500");
        if (result.error.type === "FETCH_FAILED") {
          expect(result.error.status).toBe(500);
        }
      }
    });

    it("should preserve custom RequestInit options", async () => {
      const mockResponse = new Response("test", { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const customOptions = {
        method: "POST",
        body: "test data",
        headers: {
          "Content-Type": "application/json",
        },
      };

      await safeFetch("https://example.com", customOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          method: "POST",
          body: "test data",
          headers: {
            "User-Agent": "FeedFinder/1.0",
            "Content-Type": "application/json",
          },
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("should handle successful HEAD request", async () => {
      const mockResponse = new Response(null, {
        status: 200,
        headers: {
          "content-type": "application/rss+xml",
        },
      });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await safeFetch("https://example.com", { method: "HEAD" });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe(200);
        expect(result.value.headers.get("content-type")).toBe(
          "application/rss+xml",
        );
      }

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          method: "HEAD",
        }),
      );
    });

    it("should cleanup timeout on successful response", async () => {
      const mockResponse = new Response("test", { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const result = await safeFetch("https://example.com");

      expect(result.isOk()).toBe(true);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("should cleanup timeout on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const result = await safeFetch("https://example.com");

      expect(result.isErr()).toBe(true);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
