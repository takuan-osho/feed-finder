import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_REDIRECTS } from "../config";
import { safeFetch } from "./fetch";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

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
      vi.spyOn(globalThis, "setTimeout").mockImplementation((callback) => {
        // Call callback immediately to simulate timeout
        if (typeof callback === "function") {
          callback();
        }
        return 1 as unknown as ReturnType<typeof setTimeout>;
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

      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      const result = await safeFetch("https://example.com");

      expect(result.isOk()).toBe(true);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("should cleanup timeout on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      const result = await safeFetch("https://example.com");

      expect(result.isErr()).toBe(true);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
  describe("safeFetch redirect handling", () => {
    const redirect = (location: string | null, status = 302) =>
      new Response("redirect body", {
        status,
        headers: location === null ? {} : { Location: location },
      });

    it("should request with redirect: manual", async () => {
      mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

      await safeFetch("https://example.com");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({ redirect: "manual" }),
      );
    });

    it.each([301, 302, 303, 307, 308])(
      "should follow a %i redirect to a validated public URL",
      async (status) => {
        const final = new Response("final", { status: 200 });
        mockFetch
          .mockResolvedValueOnce(
            redirect("https://other.example.com/feed", status),
          )
          .mockResolvedValueOnce(final);

        const result = await safeFetch("https://example.com/");

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe(final);
        }
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          "https://other.example.com/feed",
          expect.objectContaining({ redirect: "manual" }),
        );
      },
    );

    it("should resolve a relative Location against the current URL", async () => {
      mockFetch
        .mockResolvedValueOnce(redirect("../feed.xml"))
        .mockResolvedValueOnce(redirect("/atom.xml"))
        .mockResolvedValueOnce(new Response("ok", { status: 200 }));

      const result = await safeFetch("https://example.com/blog/post/");

      expect(result.isOk()).toBe(true);
      expect(mockFetch.mock.calls.map((call) => call[0])).toEqual([
        "https://example.com/blog/post/",
        "https://example.com/blog/feed.xml",
        "https://example.com/atom.xml",
      ]);
    });

    it("should keep method and headers on every hop", async () => {
      mockFetch
        .mockResolvedValueOnce(redirect("https://other.example.com/"))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      await safeFetch("https://example.com/", {
        method: "HEAD",
        headers: { Accept: "application/xml" },
      });

      for (const call of mockFetch.mock.calls) {
        expect(call[1]).toEqual(
          expect.objectContaining({
            method: "HEAD",
            redirect: "manual",
            headers: {
              "User-Agent": "FeedFinder/1.0",
              Accept: "application/xml",
            },
          }),
        );
      }
    });

    it.each([
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1/",
      "http://[::1]/",
      "http://localhost/",
      "http://example.com:22/",
      "ftp://example.com/",
    ])("should refuse to follow a redirect to %s", async (location) => {
      const hop = redirect(location);
      const cancel = vi.spyOn(hop.body!, "cancel");
      mockFetch.mockResolvedValueOnce(hop);

      const result = await safeFetch("https://example.com/");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FETCH_FAILED");
        expect(result.error.message).toContain("Redirect target not permitted");
      }
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalled();
    });

    it("should fail when a redirect has no Location header", async () => {
      mockFetch.mockResolvedValueOnce(redirect(null));

      const result = await safeFetch("https://example.com/");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FETCH_FAILED");
        expect(result.error.message).toBe("Redirect without Location header");
      }
    });

    it("should fail when the Location header is not a valid URL", async () => {
      mockFetch.mockResolvedValueOnce(redirect("http://[invalid"));

      const result = await safeFetch("https://example.com/");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FETCH_FAILED");
        expect(result.error.message).toContain("Invalid redirect location");
      }
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should follow exactly MAX_REDIRECTS redirects", async () => {
      expect(MAX_REDIRECTS).toBe(5);
      for (let i = 0; i < MAX_REDIRECTS; i++) {
        mockFetch.mockResolvedValueOnce(
          redirect(`https://example.com/${i + 1}`),
        );
      }
      mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

      const result = await safeFetch("https://example.com/0");

      expect(result.isOk()).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
    });

    it("should fail after more than MAX_REDIRECTS redirects", async () => {
      mockFetch.mockImplementation(async () =>
        redirect("https://example.com/loop"),
      );

      const result = await safeFetch("https://example.com/");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FETCH_FAILED");
        expect(result.error.message).toBe(
          `Too many redirects (max ${MAX_REDIRECTS})`,
        );
      }
      expect(mockFetch).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
    });

    it("should cancel the body of each followed redirect response", async () => {
      const first = redirect("https://example.com/a");
      const second = redirect("https://example.com/b");
      const cancelFirst = vi.spyOn(first.body!, "cancel");
      const cancelSecond = vi.spyOn(second.body!, "cancel");
      mockFetch
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(second)
        .mockResolvedValueOnce(new Response("ok", { status: 200 }));

      await safeFetch("https://example.com/");

      expect(cancelFirst).toHaveBeenCalled();
      expect(cancelSecond).toHaveBeenCalled();
    });

    it("should ignore errors when cancelling a redirect body", async () => {
      const hop = redirect("https://example.com/a");
      vi.spyOn(hop.body!, "cancel").mockRejectedValue(new Error("boom"));
      mockFetch
        .mockResolvedValueOnce(hop)
        .mockResolvedValueOnce(new Response("ok", { status: 200 }));

      const result = await safeFetch("https://example.com/");

      expect(result.isOk()).toBe(true);
    });

    it("should follow a redirect response without a body", async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(null, {
            status: 301,
            headers: { Location: "https://example.com/a" },
          }),
        )
        .mockResolvedValueOnce(new Response("ok", { status: 200 }));

      const result = await safeFetch("https://example.com/");

      expect(result.isOk()).toBe(true);
    });

    it("should not treat a non-redirect 3xx as a redirect", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 304,
          headers: { Location: "https://example.com/a" },
        }),
      );

      const result = await safeFetch("https://example.com/");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FETCH_FAILED");
        expect(result.error.message).toBe("HTTP 304");
      }
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should use one timeout for the whole redirect chain", async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
      let firstSignal: AbortSignal | undefined;
      mockFetch.mockImplementation((_url, options: RequestInit) => {
        firstSignal ??= options.signal ?? undefined;
        expect(options.signal).toBe(firstSignal);
        if (mockFetch.mock.calls.length < 3) {
          return Promise.resolve(redirect("https://example.com/next"));
        }
        return Promise.resolve(new Response("ok", { status: 200 }));
      });

      const result = await safeFetch("https://example.com/");

      expect(result.isOk()).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    });

    it("should time out when the chain exceeds FETCH_TIMEOUT_MS", async () => {
      mockFetch.mockImplementation(
        (_url, options: RequestInit) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => resolve(redirect("https://example.com/next")),
              2000,
            );
            options.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(
                Object.assign(new Error("aborted"), { name: "AbortError" }),
              );
            });
          }),
      );

      const pending = safeFetch("https://example.com/");
      await vi.advanceTimersByTimeAsync(6000);
      const result = await pending;

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("TIMEOUT_ERROR");
      }
      // 2s + 2s + aborted during the third hop (5s total budget)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
