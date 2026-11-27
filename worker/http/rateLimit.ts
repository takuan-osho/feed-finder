import { RATE_LIMIT_RETRY_AFTER_SECONDS } from "../config";
import { logger } from "../observability/logger";

/**
 * The part of the Worker env used for rate limiting. The binding is optional
 * at runtime (unit tests, local dev without the binding), so the check fails
 * open when it is absent.
 */
export interface RateLimitEnv {
  RATE_LIMITER?: Pick<Env["RATE_LIMITER"], "limit">;
}

const FALLBACK_KEY = "unknown";

/**
 * Returns true when the client identified by `cf-connecting-ip` is over the
 * limit. Missing binding or a failing `limit()` call lets the request through.
 * The client IP is used only as the limiter key and never logged.
 */
export async function isRateLimited(
  request: Request,
  env: RateLimitEnv,
  requestId?: string,
): Promise<boolean> {
  const limiter = env.RATE_LIMITER;
  if (!limiter) return false;

  const key = request.headers.get("cf-connecting-ip") ?? FALLBACK_KEY;
  try {
    const { success } = await limiter.limit({ key });
    return !success;
  } catch (error) {
    logger.warn(
      {
        error_name: error instanceof Error ? error.name : "NonError",
        error_message: error instanceof Error ? error.message : String(error),
        ...(requestId !== undefined ? { request_id: requestId } : {}),
      },
      "rate_limit_check_failed",
    );
    return false;
  }
}

export function createRateLimitedResponse(requestId?: string): Response {
  logger.warn(
    requestId !== undefined ? { request_id: requestId } : {},
    "rate_limited",
  );
  return Response.json(
    { success: false, error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS) },
    },
  );
}
