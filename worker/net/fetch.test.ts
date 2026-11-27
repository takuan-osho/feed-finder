import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FETCH_TIMEOUT_MS, MAX_REDIRECTS, MAX_RESPONSE_BYTES } from "../config";
import {
  fetchText,
  isTextLikeContentType,
  readBodyWithLimit,
  safeFetch,
} from "./fetch";

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
  describe("readBodyWithLimit", () => {
    const encoder = new TextEncoder();

    /** Builds a stream from byte chunks and records whether it was cancelled */
    const streamOf = (chunks: Uint8Array[]) => {
      const state = { cancelled: false, pulls: 0 };
      let index = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          state.pulls++;
          if (index < chunks.length) {
            controller.enqueue(chunks[index++]);
          } else {
            controller.close();
          }
        },
        cancel() {
          state.cancelled = true;
        },
      });
      return { response: new Response(stream), state };
    };

    it("should read a body under the limit", async () => {
      const { response, state } = streamOf([encoder.encode("hello")]);

      const result = await readBodyWithLimit(response, 10);

      expect(result._unsafeUnwrap()).toBe("hello");
      expect(state.cancelled).toBe(false);
    });

    it("should read a body exactly at the limit", async () => {
      const { response, state } = streamOf([encoder.encode("0123456789")]);

      const result = await readBodyWithLimit(response, 10);

      expect(result._unsafeUnwrap()).toBe("0123456789");
      expect(state.cancelled).toBe(false);
    });

    it("should truncate a body over the limit and cancel the stream", async () => {
      const { response, state } = streamOf([
        encoder.encode("0123456"),
        encoder.encode("789abc"),
        encoder.encode("never read"),
      ]);

      const result = await readBodyWithLimit(response, 10);

      expect(result._unsafeUnwrap()).toBe("0123456789");
      expect(state.cancelled).toBe(true);
      expect(state.pulls).toBeLessThan(4);
    });

    it("should concatenate multiple chunks", async () => {
      const { response } = streamOf([
        encoder.encode("<html>"),
        encoder.encode("<head>"),
        encoder.encode("</head>"),
      ]);

      const result = await readBodyWithLimit(response, 100);

      expect(result._unsafeUnwrap()).toBe("<html><head></head>");
    });

    it("should decode multi-byte UTF-8 split across chunks", async () => {
      const bytes = encoder.encode("フィード"); // 3 bytes per character
      const { response } = streamOf([
        bytes.slice(0, 2),
        bytes.slice(2, 4),
        bytes.slice(4),
      ]);

      const result = await readBodyWithLimit(response, 100);

      expect(result._unsafeUnwrap()).toBe("フィード");
    });

    it("should return an empty string for an empty body", async () => {
      const { response } = streamOf([]);

      const result = await readBodyWithLimit(response, 10);

      expect(result._unsafeUnwrap()).toBe("");
    });

    it("should return an empty string when body is null", async () => {
      const response = new Response(null);
      expect(response.body).toBeNull();

      const result = await readBodyWithLimit(response, 10);

      expect(result._unsafeUnwrap()).toBe("");
    });

    it("should return PARSING_ERROR when the stream errors", async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("partial"));
          controller.error(new Error("connection reset"));
        },
      });

      const result = await readBodyWithLimit(new Response(stream), 100);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("PARSING_ERROR");
      }
    });

    it("should return TIMEOUT_ERROR when the signal aborts during the read", async () => {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("slow"));
          // never closes: simulates a slow-drip body
        },
        cancel() {
          cancelled = true;
        },
      });
      const controller = new AbortController();

      const pending = readBodyWithLimit(
        new Response(stream),
        100,
        controller.signal,
      );
      setTimeout(() => controller.abort(), 100);
      await vi.advanceTimersByTimeAsync(100);
      const result = await pending;

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("TIMEOUT_ERROR");
      }
      expect(cancelled).toBe(true);
    });

    it("should return TIMEOUT_ERROR when the signal is already aborted", async () => {
      const { response, state } = streamOf([encoder.encode("hello")]);
      const controller = new AbortController();
      controller.abort();

      const result = await readBodyWithLimit(response, 10, controller.signal);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("TIMEOUT_ERROR");
      }
      expect(state.cancelled).toBe(true);
    });
  });

  describe("isTextLikeContentType", () => {
    it.each([
      null,
      "",
      "text/html",
      "TEXT/HTML; charset=utf-8",
      "text/plain",
      "application/xhtml+xml",
      "application/xml",
      "application/rss+xml",
    ])("should treat %s as text", (contentType) => {
      expect(isTextLikeContentType(contentType)).toBe(true);
    });

    it.each([
      "application/octet-stream",
      "image/png",
      "video/mp4",
      "application/json",
      "application/pdf",
    ])("should not treat %s as text", (contentType) => {
      expect(isTextLikeContentType(contentType)).toBe(false);
    });
  });

  describe("fetchText", () => {
    it("should use a 2 MiB response limit", () => {
      expect(MAX_RESPONSE_BYTES).toBe(2 * 1024 * 1024);
    });

    it("should return the body of a text response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("<html></html>", {
          headers: { "content-type": "text/html" },
        }),
      );

      const result = await fetchText("https://example.com/");

      expect(result._unsafeUnwrap()).toBe("<html></html>");
    });

    it("should read the body when Content-Type is missing", async () => {
      const response = new Response("<html></html>");
      response.headers.delete("content-type");
      mockFetch.mockResolvedValueOnce(response);

      const result = await fetchText("https://example.com/");

      expect(result._unsafeUnwrap()).toBe("<html></html>");
    });

    it("should skip and cancel a non-text body", async () => {
      const response = new Response("binary", {
        headers: { "content-type": "application/octet-stream" },
      });
      const cancel = vi.spyOn(response.body!, "cancel");
      mockFetch.mockResolvedValueOnce(response);

      const result = await fetchText("https://example.com/");

      expect(result._unsafeUnwrap()).toBeNull();
      expect(cancel).toHaveBeenCalled();
    });

    it("should truncate a body larger than MAX_RESPONSE_BYTES", async () => {
      const head = "<html><head></head>";
      const big = head + "x".repeat(MAX_RESPONSE_BYTES);
      mockFetch.mockResolvedValueOnce(
        new Response(big, { headers: { "content-type": "text/html" } }),
      );

      const result = await fetchText("https://example.com/");

      const text = result._unsafeUnwrap();
      expect(text).not.toBeNull();
      expect(text!.length).toBe(MAX_RESPONSE_BYTES);
      expect(text!.startsWith(head)).toBe(true);
    });

    it("should propagate fetch errors", async () => {
      mockFetch.mockResolvedValueOnce(new Response("nope", { status: 404 }));

      const result = await fetchText("https://example.com/");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FETCH_FAILED");
      }
    });

    it("should time out while reading a slow body", async () => {
      mockFetch.mockImplementation((_url, options: RequestInit) => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("<html>"));
            options.signal?.addEventListener("abort", () => {
              controller.error(
                Object.assign(new Error("aborted"), { name: "AbortError" }),
              );
            });
          },
        });
        return Promise.resolve(
          new Response(stream, { headers: { "content-type": "text/html" } }),
        );
      });

      const pending = fetchText("https://example.com/");
      await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
      const result = await pending;

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("TIMEOUT_ERROR");
      }
    });

    it("should clear the timeout once the body is read", async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      mockFetch.mockResolvedValueOnce(
        new Response("ok", { headers: { "content-type": "text/html" } }),
      );

      await fetchText("https://example.com/");

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
