/**
 * GET|POST /api/cron/probes
 *
 * External-cron entry point for the health-probe sweep. Cloudflare Pages
 * Functions don't natively support `scheduled()` handlers, so the supported
 * way to keep `launchops_probe_history` populated on a fixed cadence is to
 * have any external scheduler (Cloudflare Cron Trigger Worker, cron-job.org,
 * BetterStack heartbeats, GitHub Actions schedule) call this endpoint every
 * ~5 minutes.
 *
 * Authentication:
 *   Authorization: Bearer <LAUNCHOPS_ADMIN_SECRET>
 *   — or —
 *   ?token=<LAUNCHOPS_ADMIN_SECRET>     (for schedulers that can't set headers)
 *
 * Returns the per-probe results plus a small summary so the caller can log
 * a meaningful response in their own UI.
 *
 * The opportunistic on-visit refresh in `/api/public/projects` still runs
 * — this just guarantees a baseline cadence even when the landing page has
 * no traffic.
 */
import { type Env, err, json, nowSec, timingSafeEqual } from "../../_lib/env";
import { runHealthProbes } from "../../_lib/probes";

function extractToken(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const url = new URL(request.url);
  return url.searchParams.get("token");
}

const handler: PagesFunction<Env> = async ({ request, env }) => {
  const expected = env.LAUNCHOPS_ADMIN_SECRET ?? "";
  if (!expected) return err(503, "cron not configured", { hint: "set LAUNCHOPS_ADMIN_SECRET" });
  const token = extractToken(request);
  if (!token || !timingSafeEqual(token, expected)) return err(401, "unauthorized");

  const t0 = Date.now();
  let results;
  try {
    results = await runHealthProbes(env, { timeoutMs: 8000, source: "cron" });
  } catch (e) {
    return err(500, "probe sweep failed", { detail: String(e) });
  }
  const elapsedMs = Date.now() - t0;
  const ok = results.filter((r) => r.ok).length;

  return json({
    ok: true,
    generatedAt: nowSec(),
    elapsedMs,
    counts: { total: results.length, ok, down: results.length - ok },
    results,
  });
};

export const onRequestGet = handler;
export const onRequestPost = handler;
