import { ResultAsync } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { discoverFeeds } from "./discovery";
import worker from "./index";

vi.mock("./discovery", () => ({ discoverFeeds: vi.fn() }));

interface LogLine {
  level: string;
  msg?: string;
  event?: string;
  status_code?: number;
  error_id?: string;
  error_name?: string;
  error_message?: string;
  stack?: string;
  request_id?: string;
}

const parseLines = (spies: ReturnType<typeof vi.spyOn>[]): LogLine[] =>
  spies.flatMap((spy) =>
    spy.mock.calls
      .map((call) => call[0])
      .filter((raw): raw is string => typeof raw === "string")
      .map((raw) => JSON.parse(raw) as LogLine),
  );

const searchRequest = (): Request =>
  new Request("https://test.com/api/search-feeds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-ray": "ray-boundary",
      Origin: "https://feedfinder.programarch.com",
    },
    body: JSON.stringify({ url: "https://example.com" }),
  });

describe("worker top-level error boundary", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(discoverFeeds).mockReset();
  });

  it.each([
    [
      "a synchronous throw",
      () => {
        throw new Error("boom: internal detail");
      },
    ],
    [
      "an async rejection",
      // A ResultAsync whose inner promise rejects (bypasses the Err channel).
      () => new ResultAsync(Promise.reject(new Error("boom: internal detail"))),
    ],
  ])(
    "turns %s into a generic 500 with security headers",
    async (_label, impl) => {
      vi.mocked(discoverFeeds).mockImplementation(
        impl as unknown as typeof discoverFeeds,
      );

      const response = await worker.fetch(searchRequest());

      expect(response.status).toBe(500);
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://feedfinder.programarch.com",
      );
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      const text = await response.text();
      expect(text).not.toContain("boom");
      expect(text).not.toContain("internal detail");
      expect(text).not.toContain("at ");
      const body = JSON.parse(text) as {
        success: boolean;
        error: string;
        errorId: string;
      };
      expect(body.success).toBe(false);
      expect(body.error).toBe(
        "An unexpected error occurred. Please try again later.",
      );

      const lines = parseLines([logSpy, warnSpy, errSpy]);
      const unhandled = lines.filter((l) => l.msg === "unhandled_exception");
      expect(unhandled).toHaveLength(1);
      expect(unhandled[0]).toMatchObject({
        level: "error",
        error_id: body.errorId,
        error_name: "Error",
        error_message: "boom: internal detail",
        request_id: "ray-boundary",
      });
      expect(unhandled[0]?.stack).toBeTypeOf("string");

      const access = lines.filter((l) => l.event === "http_access");
      expect(access).toHaveLength(1);
      expect(access[0]).toMatchObject({
        level: "error",
        status_code: 500,
        request_id: "ray-boundary",
      });
    },
  );

  it("does not interfere with handled errors", async () => {
    const response = await worker.fetch(
      new Request("https://test.com/api/search-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad",
      }),
    );

    expect(response.status).toBe(400);
    const lines = parseLines([logSpy, warnSpy, errSpy]);
    expect(lines.some((l) => l.msg === "unhandled_exception")).toBe(false);
    expect(discoverFeeds).not.toHaveBeenCalled();
  });
});
