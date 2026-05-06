/**
 * GET /api/public/probes
 *
 * Aggregated last-24h probe stats per (project, target). Used by the public
 * landing page to draw the latency strip.
 */
import { type Env, json, nowSec } from "../../_lib/env";

type Row = { project_slug: string; target: string; ok: number; latency_ms: number | null; ts: number };

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const since = nowSec() - 24 * 60 * 60;
  let rows: Row[] = [];
  try {
    const r = await env.DB.prepare(
      `SELECT project_slug, target, ok, latency_ms, ts
       FROM launchops_health_snapshots
       WHERE ts >= ?
       ORDER BY ts DESC
       LIMIT 5000`,
    )
      .bind(since)
      .all<Row>();
    rows = r.results ?? [];
  } catch {
    rows = [];
  }

  const grouped = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.project_slug}::${r.target}`;
    const arr = grouped.get(key) ?? [];
    arr.push(r);
    grouped.set(key, arr);
  }

  const probes = Array.from(grouped.entries()).map(([key, arr]) => {
    const [project, target] = key.split("::");
    const sorted = arr
      .map((r) => r.latency_ms)
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b);
    const pct = (q: number) =>
      sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    const okCount = arr.filter((r) => r.ok).length;
    return {
      project,
      target,
      total: arr.length,
      ok: okCount,
      uptimePct: arr.length === 0 ? null : Number(((okCount / arr.length) * 100).toFixed(2)),
      p50: pct(0.5),
      p95: pct(0.95),
      p99: pct(0.99),
      latest: arr.slice(0, 30).map((r) => ({
        ok: !!r.ok,
        latencyMs: r.latency_ms,
        ts: r.ts,
      })),
    };
  });

  return json(
    { probes, generatedAt: nowSec() },
    { headers: { "cache-control": "public, max-age=15, s-maxage=60, stale-while-revalidate=300" } },
  );
};
