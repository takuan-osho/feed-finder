import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logAccess, logger } from "./logger";

interface ParsedLog {
  level: string;
  msg?: string;
  ts?: string;
  service?: string;
  event?: string;
  status_code?: number;
  duration_ms?: number;
  method?: string;
  route?: string;
  request_id?: string;
  error_type?: string;
  error_id?: string;
}

const parseLastCall = (spy: ReturnType<typeof vi.spyOn>): ParsedLog => {
  const calls = spy.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const last = calls[calls.length - 1][0];
  expect(typeof last).toBe("string");
  return JSON.parse(last as string) as ParsedLog;
};

describe("observability/logger", () => {
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
  });

  describe("pino logger", () => {
    it("emits info as JSON via console.log with service and ts", () => {
      logger.info({ request_id: "req-1" }, "worker started");

      expect(logSpy).toHaveBeenCalledTimes(1);
      const log = parseLastCall(logSpy);

      expect(log.level).toBe("info");
      expect(log.msg).toBe("worker started");
      expect(log.request_id).toBe("req-1");
      expect(log.service).toBe("feed-finder");
      expect(log.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("emits error as JSON via console.error", () => {
      logger.error({ error_type: "FETCH_FAILED", error_id: "abc123" }, "boom");

      expect(errSpy).toHaveBeenCalledTimes(1);
      const log = parseLastCall(errSpy);

      expect(log.level).toBe("error");
      expect(log.msg).toBe("boom");
      expect(log.error_type).toBe("FETCH_FAILED");
      expect(log.error_id).toBe("abc123");
    });

    it("emits warn as JSON via console.warn", () => {
      logger.warn({ kind: "deprecation" }, "old path");

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const log = parseLastCall(warnSpy);

      expect(log.level).toBe("warn");
      expect(log.msg).toBe("old path");
    });
  });

  describe("logAccess", () => {
    it("emits event=http_access with status_code, duration_ms, method, route", () => {
      logAccess({
        method: "POST",
        route: "/api/search-feeds",
        status_code: 200,
        duration_ms: 123,
        request_id: "req-xyz",
      });

      const log = parseLastCall(logSpy);
      expect(log.event).toBe("http_access");
      expect(log.level).toBe("info");
      expect(log.status_code).toBe(200);
      expect(log.duration_ms).toBe(123);
      expect(log.method).toBe("POST");
      expect(log.route).toBe("/api/search-feeds");
      expect(log.request_id).toBe("req-xyz");
    });

    it("uses console.error when status_code >= 500", () => {
      logAccess({
        method: "POST",
        route: "/api/search-feeds",
        status_code: 502,
        duration_ms: 10,
      });

      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();
      const log = parseLastCall(errSpy);
      expect(log.level).toBe("error");
      expect(log.status_code).toBe(502);
    });

    it("uses console.warn for 4xx", () => {
      logAccess({
        method: "POST",
        route: "/api/search-feeds",
        status_code: 404,
        duration_ms: 5,
      });

      const log = parseLastCall(warnSpy);
      expect(log.level).toBe("warn");
      expect(log.status_code).toBe(404);
    });

    it("rounds duration_ms to integer", () => {
      logAccess({
        method: "GET",
        route: "/",
        status_code: 200,
        duration_ms: 12.7,
      });

      const log = parseLastCall(logSpy);
      expect(log.duration_ms).toBe(13);
    });
  });
});
