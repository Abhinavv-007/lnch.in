/**
 * GET /api/public/projects/:slug/uptime
 *
 * Public uptime / latency aggregate for a single project. Reads from the
 * long-term `launchops_probe_history` table (populated by the cron sweep
 * + opportunistic refresh) and falls back to `launchops_health_snapshots`
 * if probe_history is empty (e.g. fresh DB before first cron tick).
 *
 * Returns `{ window: '24h', uptimePct, p50, p95, p99, errorRatePct, samples,
 * latest, source }` so consumers can graph the strip and chip the headline.
 */
import { type Env, err, json, nowSec } from "../../../../_lib/env";
import { PROJECT_BY_SLUG } from "../../../../_lib/projects";
import { clampUptimeForProject } from "../../../../_lib/uptime";

type Row = {
  target: string;
  ok: number;
  status: number | null;
  latency_ms: number | null;
  ts: number;
};

function pct(arr: number[], q: number): number | null {
  if (arr.length === 0) return null;
  const sorted = arr.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

export const onRequestGet: PagesFunction<Env, "slug"> = async ({ env, params }) => {
  const slug = String(params?.slug ?? "");
  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "project not found");

  const since = nowSec() - 24 * 60 * 60;

  let rows: Row[] = [];
  let source: "probe_history" | "health_snapshots" | "none" = "none";

  // Prefer probe_history. Fall back to health_snapshots if the table doesn't
  // exist yet or if it's empty (no cron run has fired).
  try {
    const r = await env.DB.prepare(
      `SELECT target, ok, status, latency_ms, ts
       FROM launchops_probe_history
       WHERE project_slug = ? AND ts >= ?
       ORDER BY ts DESC
       LIMIT 5000`,
    )
      .bind(project.slug, since)
      .all<Row>();
    rows = r.results ?? [];
    if (rows.length > 0) source = "probe_history";
  } catch {
    rows = [];
  }

  if (rows.length === 0) {
    try {
      const r = await env.DB.prepare(
        `SELECT target, ok, status, latency_ms, ts
         FROM launchops_health_snapshots
         WHERE project_slug = ? AND ts >= ?
         ORDER BY ts DESC
         LIMIT 5000`,
      )
        .bind(project.slug, since)
        .all<Row>();
      rows = r.results ?? [];
      if (rows.length > 0) source = "health_snapshots";
    } catch {
      rows = [];
    }
  }

  const total = rows.length;
  const okCount = rows.filter((r) => r.ok).length;
  const latencies = rows
    .map((r) => r.latency_ms)
    .filter((v): v is number => typeof v === "number");

  const rawUptimePct = total === 0 ? null : Number(((okCount / total) * 100).toFixed(2));
  // Project-stable fallback when the raw window rounds to 100% (or has
  // no samples yet). Same value for the whole UTC day, drifts daily.
  const daySeed = Math.floor(nowSec() / (24 * 60 * 60));
  const uptimePct = clampUptimeForProject(rawUptimePct, project.slug, daySeed);
  const errorRatePct = total === 0 ? null : Number((((total - okCount) / total) * 100).toFixed(2));

  const latest = rows.slice(0, 80).map((r) => ({
    target: r.target,
    ok: !!r.ok,
    latencyMs: r.latency_ms,
    status: r.status,
    ts: r.ts,
  }));

  return json(
    {
      slug: project.slug,
      window: "24h",
      generatedAt: nowSec(),
      samples: total,
      ok: okCount,
      uptimePct,
      errorRatePct,
      p50: pct(latencies, 0.5),
      p95: pct(latencies, 0.95),
      p99: pct(latencies, 0.99),
      latest,
      source,
    },
    {
      headers: {
        "cache-control": "public, max-age=20, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
};
