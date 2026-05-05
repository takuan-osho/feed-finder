import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface AccessLog {
  level: string;
  msg?: string;
  event?: string;
  method?: string;
  route?: string;
  status_code?: number;
  duration_ms?: number;
  request_id?: string;
}

const findHttpAccess = (
  spies: ReturnType<typeof vi.spyOn>[],
): AccessLog | undefined => {
  for (const spy of spies) {
    for (const call of spy.mock.calls) {
      const raw = call[0];
      if (typeof raw !== "string") continue;
      try {
        const parsed = JSON.parse(raw) as AccessLog;
        if (parsed.event === "http_access") return parsed;
      } catch {
        // ignore non-JSON
      }
    }
  }
  return undefined;
};

describe("worker access log", () => {
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

  it("emits http_access info log for unknown path (404)", async () => {
    const { default: worker } = await import("./index");
    const request = new Request("https://test.com/nonexistent", {
      method: "GET",
    });
    const response = await worker.fetch(request);

    expect(response.status).toBe(404);

    const access = findHttpAccess([logSpy, warnSpy, errSpy]);
    expect(access).toBeDefined();
    expect(access?.event).toBe("http_access");
    expect(access?.method).toBe("GET");
    expect(access?.route).toBe("/nonexistent");
    expect(access?.status_code).toBe(404);
    expect(typeof access?.duration_ms).toBe("number");
    expect(access?.level).toBe("warn");
  });

  it("emits http_access info log on 200 (CORS preflight)", async () => {
    const { default: worker } = await import("./index");
    const request = new Request("https://test.com/api/search-feeds", {
      method: "OPTIONS",
      headers: {
        Origin: "https://feedfinder.programarch.com",
        "Access-Control-Request-Method": "POST",
      },
    });
    const response = await worker.fetch(request);

    expect(response.status).toBeGreaterThanOrEqual(200);

    const access = findHttpAccess([logSpy, warnSpy, errSpy]);
    expect(access).toBeDefined();
    expect(access?.method).toBe("OPTIONS");
    expect(access?.route).toBe("/api/search-feeds");
  });

  it("propagates cf-ray as request_id when present", async () => {
    const { default: worker } = await import("./index");
    const request = new Request("https://test.com/missing", {
      method: "GET",
      headers: { "cf-ray": "abc123-xyz" },
    });
    await worker.fetch(request);

    const access = findHttpAccess([logSpy, warnSpy, errSpy]);
    expect(access?.request_id).toBe("abc123-xyz");
  });
});
