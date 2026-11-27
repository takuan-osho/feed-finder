import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRateLimitedResponse, isRateLimited } from "./rateLimit";

const request = (): Request =>
  new Request("https://test.com/api/search-feeds", { method: "POST" });

describe("http/rateLimit", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const lastWarn = (): Record<string, unknown> =>
    JSON.parse(warnSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;

  it("fails open on a non-Error rejection and omits request_id when absent", async () => {
    const limit = vi.fn(() => Promise.reject("quota backend down"));

    const limited = await isRateLimited(request(), { RATE_LIMITER: { limit } });

    expect(limited).toBe(false);
    const log = lastWarn();
    expect(log).toMatchObject({
      msg: "rate_limit_check_failed",
      error_name: "NonError",
      error_message: "quota backend down",
    });
    expect(log).not.toHaveProperty("request_id");
  });

  it("returns true only when the limiter reports failure", async () => {
    const env = (success: boolean) => ({
      RATE_LIMITER: { limit: vi.fn(async () => ({ success })) },
    });

    expect(await isRateLimited(request(), env(true))).toBe(false);
    expect(await isRateLimited(request(), env(false))).toBe(true);
  });

  it("logs rate_limited without request_id when none is given", async () => {
    const response = createRateLimitedResponse();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    const log = lastWarn();
    expect(log["msg"]).toBe("rate_limited");
    expect(log).not.toHaveProperty("request_id");
  });
});
