/**
 * Public API middleware.
 *
 * Cloudflare Pages runs every `_middleware.ts` whose directory is a prefix of
 * the matched route, so this file is invoked for every `/api/public/**` call.
 *
 * Two responsibilities:
 *   1. Per-IP rate limiting (1000 req / 24h per IP, KV-backed).
 *   2. Adding `x-ratelimit-*` headers to the downstream response so callers
 *      know how much budget they have left.
 *
 * The `/api/public/health` endpoint is allowed through without consuming
 * budget so external uptime monitors never trip the limiter.
 */
import type { Env } from "../../_lib/env";
import {
  buildLimitExceededResponse,
  checkRateLimit,
  rateLimitHeaders,
} from "../../_lib/rateLimit";
import { recordPublicCall } from "../../_lib/publicAudit";

const NO_CHARGE_PATHS = new Set(["/api/public/health"]);

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { env, request, next } = ctx;
  const url = new URL(request.url);

  if (NO_CHARGE_PATHS.has(url.pathname)) {
    return next();
  }

  const t0 = Date.now();
  const decision = await checkRateLimit(env, request);
  if (!decision.ok) {
    const blocked = buildLimitExceededResponse(decision);
    ctx.waitUntil(
      recordPublicCall(env, {
        request,
        status: blocked.status,
        latencyMs: Date.now() - t0,
        decision,
      }),
    );
    return blocked;
  }

  const downstream = await next();
  const merged = new Headers(downstream.headers);
  for (const [k, v] of Object.entries(rateLimitHeaders(decision))) {
    merged.set(k, v);
  }
  ctx.waitUntil(
    recordPublicCall(env, {
      request,
      status: downstream.status,
      latencyMs: Date.now() - t0,
      decision,
    }),
  );
  return new Response(downstream.body, {
    status: downstream.status,
    statusText: downstream.statusText,
    headers: merged,
  });
};
