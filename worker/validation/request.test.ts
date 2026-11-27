import { describe, expect, it } from "vitest";

import { MAX_REQUEST_BODY_BYTES, MAX_URL_LENGTH } from "../config";
import {
  checkContentLength,
  checkJsonContentType,
  checkUrlLength,
  normalizeUrl,
  parseRequestBody,
  readJsonBody,
} from "./request";

const streamOf = (...chunks: Uint8Array[]): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

const postWith = (
  body: BodyInit | null,
  headers: Record<string, string> = {},
): Request =>
  new Request("https://test.com/api/search-feeds", {
    method: "POST",
    headers,
    body,
    // Node's undici requires duplex for stream bodies.
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  } as RequestInit);

describe("validation/request", () => {
  describe("parseRequestBody", () => {
    it("should successfully parse valid request body with URL", () => {
      const body = { url: "https://example.com" };
      const result = parseRequestBody(body);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com");
      }
    });

    it("should fail for null body", () => {
      const result = parseRequestBody(null);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_REQUEST_BODY");
        expect(result.error.message).toBe("Invalid request body");
      }
    });

    it("should fail for undefined body", () => {
      const result = parseRequestBody(undefined);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_REQUEST_BODY");
        expect(result.error.message).toBe("Invalid request body");
      }
    });

    it("should fail for non-object body", () => {
      const result = parseRequestBody("invalid");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_REQUEST_BODY");
        expect(result.error.message).toBe("Invalid request body");
      }
    });

    it("should fail for body without url field", () => {
      const body = { notUrl: "value" };
      const result = parseRequestBody(body);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("MISSING_URL");
        expect(result.error.message).toBe("URL is required");
      }
    });

    it("should fail for body with null url", () => {
      const body = { url: null };
      const result = parseRequestBody(body);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("MISSING_URL");
        expect(result.error.message).toBe("URL is required");
      }
    });

    it("should fail for body with non-string url", () => {
      const body = { url: 123 };
      const result = parseRequestBody(body);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("MISSING_URL");
        expect(result.error.message).toBe("URL is required");
      }
    });

    it("should fail for body with empty url string", () => {
      const body = { url: "" };
      const result = parseRequestBody(body);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("MISSING_URL");
        expect(result.error.message).toBe("URL is required");
      }
    });
  });

  describe("normalizeUrl", () => {
    it("should keep HTTPS URLs as-is", () => {
      const result = normalizeUrl("https://example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com");
      }
    });

    it("should keep HTTP URLs as-is", () => {
      const result = normalizeUrl("http://example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("http://example.com");
      }
    });

    it("should add https:// prefix to URLs without protocol", () => {
      const result = normalizeUrl("example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com");
      }
    });

    it("should handle URLs with paths", () => {
      const result = normalizeUrl("example.com/path");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com/path");
      }
    });

    it("should handle URLs with query parameters", () => {
      const result = normalizeUrl("example.com?param=value");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com?param=value");
      }
    });

    it("should fail for invalid URL formats", () => {
      const invalidUrls = [
        "not a url",
        "ftp://example.com", // invalid after normalization
        "://example.com",
        "http:/",
        "",
      ];

      invalidUrls.forEach((invalidUrl) => {
        const result = normalizeUrl(invalidUrl);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("INVALID_URL_FORMAT");
          expect(result.error.message).toBe("Invalid URL format");
        }
      });
    });

    it("should handle subdomains", () => {
      const result = normalizeUrl("blog.example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://blog.example.com");
      }
    });

    it("should handle ports", () => {
      const result = normalizeUrl("example.com:8080");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://example.com:8080");
      }
    });
  });

  describe("checkJsonContentType", () => {
    it.each([
      "application/json",
      "application/json; charset=utf-8",
      "Application/JSON",
      "  application/json ;charset=UTF-8",
    ])("should accept %j", (contentType) => {
      const headers = new Headers({ "content-type": contentType });
      expect(checkJsonContentType(headers).isOk()).toBe(true);
    });

    it.each([
      "text/plain",
      "text/plain;charset=UTF-8",
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
      "application/jsonp",
      "application/json-patch+json",
      "",
    ])("should reject %j as UNSUPPORTED_MEDIA_TYPE", (contentType) => {
      const headers = new Headers({ "content-type": contentType });
      const result = checkJsonContentType(headers);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("UNSUPPORTED_MEDIA_TYPE");
      }
    });

    it("should reject a missing content-type", () => {
      const result = checkJsonContentType(new Headers());
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("UNSUPPORTED_MEDIA_TYPE");
      }
    });
  });

  describe("checkContentLength", () => {
    it("should accept a missing content-length", () => {
      expect(checkContentLength(new Headers()).isOk()).toBe(true);
    });

    it("should accept content-length equal to the limit", () => {
      const headers = new Headers({
        "content-length": String(MAX_REQUEST_BODY_BYTES),
      });
      expect(checkContentLength(headers).isOk()).toBe(true);
    });

    it("should reject content-length one byte over the limit", () => {
      const headers = new Headers({
        "content-length": String(MAX_REQUEST_BODY_BYTES + 1),
      });
      const result = checkContentLength(headers);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("PAYLOAD_TOO_LARGE");
      }
    });

    it("should ignore a non-numeric content-length (stream cap still applies)", () => {
      const headers = new Headers({ "content-length": "abc" });
      expect(checkContentLength(headers).isOk()).toBe(true);
    });
  });

  describe("readJsonBody", () => {
    it("should parse a JSON body within the limit", async () => {
      const result = await readJsonBody(
        postWith(JSON.stringify({ url: "https://example.com" })),
      );
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({ url: "https://example.com" });
      }
    });

    it("should accept a body of exactly the limit", async () => {
      const padding = "a".repeat(MAX_REQUEST_BODY_BYTES - '{"p":""}'.length);
      const body = JSON.stringify({ p: padding });
      expect(new TextEncoder().encode(body).byteLength).toBe(
        MAX_REQUEST_BODY_BYTES,
      );
      const result = await readJsonBody(postWith(body));
      expect(result.isOk()).toBe(true);
    });

    it("should reject a body one byte over the limit", async () => {
      const padding = "a".repeat(
        MAX_REQUEST_BODY_BYTES - '{"p":""}'.length + 1,
      );
      const result = await readJsonBody(
        postWith(JSON.stringify({ p: padding })),
      );
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("PAYLOAD_TOO_LARGE");
      }
    });

    it("should count bytes, not characters, for multibyte input", async () => {
      // 3 bytes per character in UTF-8; fewer characters than the limit.
      const chars = Math.floor(MAX_REQUEST_BODY_BYTES / 3) + 10;
      const body = JSON.stringify({ p: "あ".repeat(chars) });
      expect(body.length).toBeLessThan(MAX_REQUEST_BODY_BYTES);
      const result = await readJsonBody(postWith(body));
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("PAYLOAD_TOO_LARGE");
      }
    });

    it("should enforce the cap across chunks of a stream without content-length", async () => {
      const chunk = new Uint8Array(4096).fill(0x61);
      let pulled = 0;
      const endless = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulled++;
          controller.enqueue(chunk);
        },
      });
      const result = await readJsonBody(postWith(endless));
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("PAYLOAD_TOO_LARGE");
      }
      // Stops shortly after crossing the cap instead of draining forever.
      expect(pulled).toBeLessThan(10);
    });

    it("should reject an over-limit stream even if content-length lies", async () => {
      const big = new Uint8Array(MAX_REQUEST_BODY_BYTES + 1).fill(0x61);
      const request = postWith(streamOf(big), { "content-length": "10" });
      const result = await readJsonBody(request);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("PAYLOAD_TOO_LARGE");
      }
    });

    it("should reject invalid JSON as INVALID_REQUEST_BODY", async () => {
      const result = await readJsonBody(postWith("{not json"));
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_REQUEST_BODY");
      }
    });

    it("should reject an empty body as INVALID_REQUEST_BODY", async () => {
      const result = await readJsonBody(postWith(null));
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_REQUEST_BODY");
      }
    });

    it("should reject a body whose stream errors as INVALID_REQUEST_BODY", async () => {
      const broken = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error("connection reset"));
        },
      });
      const result = await readJsonBody(postWith(broken));
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_REQUEST_BODY");
      }
    });
  });

  describe("checkUrlLength", () => {
    it("should accept a URL of exactly MAX_URL_LENGTH", () => {
      const url = "https://example.com/" + "a".repeat(MAX_URL_LENGTH - 20);
      expect(url.length).toBe(MAX_URL_LENGTH);
      const result = checkUrlLength(url);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value).toBe(url);
    });

    it("should reject a URL one character over MAX_URL_LENGTH", () => {
      const url = "https://example.com/" + "a".repeat(MAX_URL_LENGTH - 19);
      const result = checkUrlLength(url);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("URL_TOO_LONG");
      }
    });
  });
});
