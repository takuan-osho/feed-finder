import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import worker from "./index";

interface LogLine {
  level: string;
  msg?: string;
  event?: string;
  request_id?: string;
  [key: string]: unknown;
}

const CLIENT_IP = "203.0.113.7";
const ENDPOINT = "https://test.com/api/search-feeds";

const mockFetch = vi.fn();

const searchRequest = (headers: Record<string, string> = {}): Request =>
  new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": CLIENT_IP,
      "cf-ray": "ray-rl",
      ...headers,
    },
    body: JSON.stringify({ url: "https://example.com" }),
  });

const limiter = (
  impl: (options: RateLimitOptions) => Promise<RateLimitOutcome>,
) => {
  const limit = vi.fn(impl);
  return { limit, env: { RATE_LIMITER: { limit } } };
};

describe("rate limiting on POST /api/search-feeds", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  const logLines = (): LogLine[] =>
    [logSpy, warnSpy, errSpy].flatMap((spy) =>
      (spy.mock.calls as unknown[][])
        .map((call): unknown => call[0])
        .filter((raw: unknown): raw is string => typeof raw === "string")
        .map((raw: string) => JSON.parse(raw) as LogLine),
    );

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "HEAD"
          ? new Response(null, { status: 404 })
          : new Response("<html></html>", {
              status: 200,
              headers: { "content-type": "text/html" },
            }),
      ),
    );
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lets the request through when under the limit, keyed by cf-connecting-ip", async () => {
    const { limit, env } = limiter(async () => ({ success: true }));

    const response = await worker.fetch(searchRequest(), env);

    expect(response.status).toBe(200);
    expect(limit).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith({ key: CLIENT_IP });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("falls back to the key 'unknown' without cf-connecting-ip", async () => {
    const { limit, env } = limiter(async () => ({ success: true }));
    const request = new Request(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });

    await worker.fetch(request, env);

    expect(limit).toHaveBeenCalledWith({ key: "unknown" });
  });

  it("responds 429 with Retry-After, a generic body and security headers when over the limit", async () => {
    const { env } = limiter(async () => ({ success: false }));
    const request = searchRequest({
      Origin: "https://feedfinder.programarch.com",
    });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://feedfinder.programarch.com",
    );
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      success: false,
      error: "Too many requests. Please try again later.",
    });
    // Limited before the body is read and before any outbound request.
    expect(request.bodyUsed).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("logs one rate_limited warning without the client IP", async () => {
    const { env } = limiter(async () => ({ success: false }));

    await worker.fetch(searchRequest(), env);

    const lines = logLines();
    const limited = lines.filter((l) => l.msg === "rate_limited");
    expect(limited).toHaveLength(1);
    expect(limited[0]).toMatchObject({ level: "warn", request_id: "ray-rl" });
    for (const line of lines) {
      expect(JSON.stringify(line)).not.toContain(CLIENT_IP);
    }
  });

  it("fails open when the binding is missing", async () => {
    const response = await worker.fetch(searchRequest(), {});

    expect(response.status).toBe(200);
    expect(logLines().some((l) => l.msg === "rate_limit_check_failed")).toBe(
      false,
    );
  });

  it("fails open with a warning when limit() throws", async () => {
    const { limit, env } = limiter(async () => {
      throw new Error("rate limiter unavailable");
    });

    const response = await worker.fetch(searchRequest(), env);

    expect(limit).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    const failed = logLines().filter(
      (l) => l.msg === "rate_limit_check_failed",
    );
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({
      level: "warn",
      request_id: "ray-rl",
      error_message: "rate limiter unavailable",
    });
    expect(JSON.stringify(failed[0])).not.toContain(CLIENT_IP);
  });

  it.each([
    ["GET", "https://test.com/"],
    ["GET", "https://test.com/api/search-feeds"],
    ["POST", "https://test.com/api/other"],
    ["OPTIONS", "https://test.com/api/search-feeds"],
  ])("does not rate limit %s %s", async (method, url) => {
    const { limit, env } = limiter(async () => ({ success: false }));

    const response = await worker.fetch(
      new Request(url, {
        method,
        headers: {
          "cf-connecting-ip": CLIENT_IP,
          Origin: "https://feedfinder.programarch.com",
          "Access-Control-Request-Method": "POST",
        },
      }),
      env,
    );

    expect(limit).not.toHaveBeenCalled();
    expect(response.status).not.toBe(429);
  });
});
