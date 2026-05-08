/**
 * KV-backed per-IP rate limiting for the public API surface.
 *
 * Hard rule: every public endpoint is bounded. The default budget is
 * `DEFAULT_DAILY_LIMIT` requests per IP per UTC day. Callers can pass a
 * tighter limit (e.g. expensive search/commit endpoints) but never lift it
 * past `DEFAULT_DAILY_LIMIT`.
 *
 * Bucket strategy: we key by `rl:public:<ip>:<utc-day>`. Counters reset at
 * UTC midnight and KV expires the entries automatically (~26h TTL).
 *
 * Failure mode: if KV isn't configured we degrade open with a warning header
 * rather than blocking the API — public reads should never be locked out
 * because the rate-limit binding is missing.
 */
import type { Env } from "./env";
import { nowSec } from "./env";

export const DEFAULT_DAILY_LIMIT = 1000;
const DAY_SEC = 24 * 60 * 60;
// Keep the KV entry around a few hours past UTC midnight so a request that
// straddles the rollover sees the new bucket immediately.
const KV_TTL_SEC = DAY_SEC + 2 * 60 * 60;

export type RateLimitDecision =
  | {
      ok: true;
      limit: number;
      used: number;
      remaining: number;
      resetSec: number;
      windowSec: number;
      ip: string;
      configured: boolean;
    }
  | {
      ok: false;
      limit: number;
      used: number;
      remaining: 0;
      resetSec: number;
      windowSec: number;
      ip: string;
      configured: true;
    };

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

function utcDayBucket(now: number): { bucket: number; resetSec: number } {
  const bucket = Math.floor(now / DAY_SEC);
  const resetSec = (bucket + 1) * DAY_SEC;
  return { bucket, resetSec };
}

/**
 * Atomically increment the per-IP counter and return the decision. The KV
 * GET → PUT pattern is not strictly atomic but acceptable for rate limiting:
 * the worst-case race lets a couple of extra requests slip through under
 * burst, never lock anyone out.
 */
export async function checkRateLimit(
  env: Env,
  request: Request,
  opts: { limit?: number } = {},
): Promise<RateLimitDecision> {
  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_DAILY_LIMIT), DEFAULT_DAILY_LIMIT);
  const ip = clientIp(request);
  const now = nowSec();
  const { bucket, resetSec } = utcDayBucket(now);
  const kvKey = `rl:public:${ip}:${bucket}`;

  if (!env.LAUNCHOPS_KV || typeof env.LAUNCHOPS_KV.get !== "function") {
    return {
      ok: true,
      limit,
      used: 0,
      remaining: limit,
      resetSec,
      windowSec: DAY_SEC,
      ip,
      configured: false,
    };
  }

  let used = 0;
  try {
    const raw = await env.LAUNCHOPS_KV.get(kvKey);
    used = raw ? Math.max(0, Number(raw) | 0) : 0;
  } catch {
    used = 0;
  }

  if (used >= limit) {
    return {
      ok: false,
      limit,
      used,
      remaining: 0,
      resetSec,
      windowSec: DAY_SEC,
      ip,
      configured: true,
    };
  }

  const next = used + 1;
  try {
    await env.LAUNCHOPS_KV.put(kvKey, String(next), { expirationTtl: KV_TTL_SEC });
  } catch {
    // If the write fails we still allow the request rather than 5xx-ing the
    // public surface. The next attempt will retry.
  }

  return {
    ok: true,
    limit,
    used: next,
    remaining: Math.max(0, limit - next),
    resetSec,
    windowSec: DAY_SEC,
    ip,
    configured: true,
  };
}

export function rateLimitHeaders(d: RateLimitDecision): Record<string, string> {
  const h: Record<string, string> = {
    "x-ratelimit-limit": String(d.limit),
    "x-ratelimit-remaining": String(d.remaining),
    "x-ratelimit-reset": String(d.resetSec),
    "x-ratelimit-window": String(d.windowSec),
    "x-ratelimit-policy": `${d.limit};w=${d.windowSec}`,
  };
  if (!d.configured) h["x-ratelimit-mode"] = "unbounded-fallback";
  if (!d.ok) h["retry-after"] = String(Math.max(1, d.resetSec - nowSec()));
  return h;
}

/**
 * Helper so individual endpoints can short-circuit if they want to bypass the
 * `_middleware` shared budget (useful for trivially small responses like the
 * health endpoint).
 */
export function buildLimitExceededResponse(d: RateLimitDecision): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "rate_limit_exceeded",
      message: `Public API capped at ${d.limit} requests / 24h per IP. Try again after ${new Date(d.resetSec * 1000).toUTCString()}.`,
      limit: d.limit,
      used: d.used,
      remaining: 0,
      resetSec: d.resetSec,
      windowSec: d.windowSec,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        ...rateLimitHeaders(d),
      },
    },
  );
}
