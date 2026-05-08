/**
 * GET /api/public/projects/:slug/probes-history
 *
 * Long-term probe time-series for a single project. Reads from the canonical
 * `launchops_probe_history` table (populated by the cron sweep + opportunistic
 * refresh) and falls back to `launchops_health_snapshots` so the endpoint
 * never returns an empty 200 just because the new table hasn't been migrated.
 *
 * Query params:
 *   - hours   1..720    default 24      window length in hours
 *   - target  string?    default any    filter to one health target URL
 *   - limit   1..2000   default 500     row cap
 *
 * Returns an array sorted by `ts` ascending so a chart can stream the points
 * straight into a path.
 */
import { type Env, err, json, nowSec } from "../../../../_lib/env";
import { PROJECT_BY_SLUG } from "../../../../_lib/projects";

type Row = {
  target: string;
  ok: number;
  status: number | null;
  latency_ms: number | null;
  ts: number;
  source?: string;
};

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw === null ? fallback : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export const onRequestGet: PagesFunction<Env, "slug"> = async ({ env, params, request }) => {
  const slug = String(params?.slug ?? "");
  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "project not found");

  const url = new URL(request.url);
  const hours = clampInt(url.searchParams.get("hours"), 24, 1, 720);
  const limit = clampInt(url.searchParams.get("limit"), 500, 1, 2000);
  const target = url.searchParams.get("target");
  const since = nowSec() - hours * 60 * 60;

  let rows: Row[] = [];
  let source: "probe_history" | "health_snapshots" | "none" = "none";

  const fetchHistory = async () => {
    if (target) {
      const r = await env.DB.prepare(
        `SELECT target, ok, status, latency_ms, ts, source
         FROM launchops_probe_history
         WHERE project_slug = ? AND ts >= ? AND target = ?
         ORDER BY ts DESC
         LIMIT ?`,
      )
        .bind(project.slug, since, target, limit)
        .all<Row>();
      return r.results ?? [];
    }
    const r = await env.DB.prepare(
      `SELECT target, ok, status, latency_ms, ts, source
       FROM launchops_probe_history
       WHERE project_slug = ? AND ts >= ?
       ORDER BY ts DESC
       LIMIT ?`,
    )
      .bind(project.slug, since, limit)
      .all<Row>();
    return r.results ?? [];
  };

  const fetchSnapshots = async () => {
    if (target) {
      const r = await env.DB.prepare(
        `SELECT target, ok, status, latency_ms, ts
         FROM launchops_health_snapshots
         WHERE project_slug = ? AND ts >= ? AND target = ?
         ORDER BY ts DESC
         LIMIT ?`,
      )
        .bind(project.slug, since, target, limit)
        .all<Row>();
      return r.results ?? [];
    }
    const r = await env.DB.prepare(
      `SELECT target, ok, status, latency_ms, ts
       FROM launchops_health_snapshots
       WHERE project_slug = ? AND ts >= ?
       ORDER BY ts DESC
       LIMIT ?`,
    )
      .bind(project.slug, since, limit)
      .all<Row>();
    return r.results ?? [];
  };

  try {
    rows = await fetchHistory();
    if (rows.length > 0) source = "probe_history";
  } catch {
    rows = [];
  }

  if (rows.length === 0) {
    try {
      rows = await fetchSnapshots();
      if (rows.length > 0) source = "health_snapshots";
    } catch {
      rows = [];
    }
  }

  // Return ascending so a renderer can pipe straight into a line chart.
  const points = rows
    .slice()
    .reverse()
    .map((r) => ({
      target: r.target,
      ok: !!r.ok,
      status: r.status,
      latencyMs: r.latency_ms,
      ts: r.ts,
      source: r.source ?? null,
    }));

  return json(
    {
      slug: project.slug,
      windowHours: hours,
      target: target ?? null,
      generatedAt: nowSec(),
      source,
      count: points.length,
      points,
    },
    {
      headers: {
        "cache-control": "public, max-age=20, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
};
