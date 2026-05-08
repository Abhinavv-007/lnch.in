/**
 * Health-probe runner used by both the gated `/api/ops/health/run` admin
 * endpoint and the public-landing background-refresh path triggered from
 * `/api/public/projects`. Kept lock-free and idempotent — concurrent calls
 * are fine; D1 inserts are append-only and the next read picks up the
 * freshest rows via MAX(ts).
 */
import { type Env, nowSec } from "./env";
import { PROJECTS } from "./projects";

export type ProbeResult = {
  project: string;
  target: string;
  ok: boolean;
  latencyMs: number;
  status: number | null;
};

/**
 * Run probes against every project's health URLs and persist them.
 *
 * Returns the array of results so callers (admin endpoints) can echo them.
 * Background callers can ignore the return value.
 *
 * Implementation note: timeout is enforced via `AbortController` so a slow
 * upstream can't drag the whole batch beyond a worker invocation budget.
 *
 * Persists to two tables:
 *   - `launchops_health_snapshots`  — current "is it up right now?" view
 *   - `launchops_probe_history`     — long-term time-series for uptime/p95
 */
export async function runHealthProbes(
  env: Env,
  opts: { timeoutMs?: number; source?: "cron" | "opportunistic" | "admin" } = {},
): Promise<ProbeResult[]> {
  const timeoutMs = opts.timeoutMs ?? 6000;
  const source = opts.source ?? "opportunistic";
  const results: ProbeResult[] = [];
  await Promise.all(
    PROJECTS.flatMap((p) =>
      (p.health ?? []).map(async (target) => {
        const start = Date.now();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetch(target, { redirect: "manual", signal: ctrl.signal });
          // Treat 405 (Method Not Allowed) as healthy — a probe HEAD/GET against
          // an endpoint that only allows POST still proves the worker is up.
          const ok = res.ok || res.status === 405;
          results.push({ project: p.slug, target, ok, latencyMs: Date.now() - start, status: res.status });
        } catch {
          results.push({ project: p.slug, target, ok: false, latencyMs: Date.now() - start, status: null });
        } finally {
          clearTimeout(timer);
        }
      }),
    ),
  );

  if (results.length > 0) {
    const ts = nowSec();
    const snapStmt = env.DB.prepare(
      "INSERT INTO launchops_health_snapshots (project_slug, target, ok, status, latency_ms, ts) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const histStmt = env.DB.prepare(
      "INSERT INTO launchops_probe_history (project_slug, target, ok, status, latency_ms, ts, source) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const batch = [
      ...results.map((r) =>
        snapStmt.bind(r.project, r.target, r.ok ? 1 : 0, r.status, r.latencyMs, ts),
      ),
      ...results.map((r) =>
        histStmt.bind(r.project, r.target, r.ok ? 1 : 0, r.status, r.latencyMs, ts, source),
      ),
    ];
    try {
      await env.DB.batch(batch);
    } catch {
      // Probe history table may not exist yet on a fresh DB — fall back to
      // snapshots-only so the live status surface still updates.
      await env.DB.batch(
        results.map((r) =>
          snapStmt.bind(r.project, r.target, r.ok ? 1 : 0, r.status, r.latencyMs, ts),
        ),
      );
    }
  }

  return results;
}

/**
 * KV-coordinated debounce so multiple concurrent landing-page visits don't
 * thunder-herd the upstream health endpoints. The first caller within
 * `windowSec` writes the marker; subsequent callers see it and skip.
 *
 * Returns true if this caller "claimed" the probe slot (and should run),
 * false if a recent probe is already in flight or just completed.
 */
export async function claimProbeSlot(env: Env, windowSec: number): Promise<boolean> {
  const KEY = "probes:last_run_ts";
  try {
    const raw = await env.LAUNCHOPS_KV.get(KEY);
    const last = raw ? Number(raw) : 0;
    const now = nowSec();
    if (Number.isFinite(last) && now - last < windowSec) return false;
    // Claim the slot. KV is eventually-consistent so a tiny race window
    // can let two probes run; that's fine — both append to D1 and the
    // freshest wins on read.
    await env.LAUNCHOPS_KV.put(KEY, String(now), { expirationTtl: Math.max(60, windowSec * 2) });
    return true;
  } catch {
    // KV not configured — fall through and run the probe so the public
    // surface still gets fresh data, even if we lose dedup.
    return true;
  }
}
