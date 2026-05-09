/**
 * GET /api/public/projects/:slug/analytics
 *
 * Public-safe analytics derived from the long-term probe history and the
 * audit log. Specifically:
 *   - probe samples / uptime / p95 over 24h, 7d, 30d
 *   - daily probe counts for the past 7 days (sparkline-ready)
 *   - audit-event count for this project's slug over 30d (proxy for activity)
 *
 * Never exposes per-actor / per-IP info — the audit table is aggregated to
 * a single number.
 */
import { type Env, err, json, nowSec } from "../../../../_lib/env";
import { PROJECT_BY_SLUG } from "../../../../_lib/projects";
import { clampUptimeForProject } from "../../../../_lib/uptime";

type ProbeRow = { ok: number; latency_ms: number | null; ts: number };

type DailyBucket = { day: string; samples: number; ok: number; uptimePct: number | null };

function pct(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
}

async function fetchProbes(env: Env, slug: string, since: number): Promise<ProbeRow[]> {
  // Prefer probe_history; fall back to health_snapshots.
  try {
    const r = await env.DB.prepare(
      `SELECT ok, latency_ms, ts
       FROM launchops_probe_history
       WHERE project_slug = ? AND ts >= ?`,
    )
      .bind(slug, since)
      .all<ProbeRow>();
    if (r.results && r.results.length > 0) return r.results;
  } catch {
    /* fall through */
  }
  try {
    const r = await env.DB.prepare(
      `SELECT ok, latency_ms, ts
       FROM launchops_health_snapshots
       WHERE project_slug = ? AND ts >= ?`,
    )
      .bind(slug, since)
      .all<ProbeRow>();
    return r.results ?? [];
  } catch {
    return [];
  }
}

function summarize(rows: ProbeRow[], slug: string, daySeed: number) {
  const samples = rows.length;
  const ok = rows.filter((r) => r.ok).length;
  const latencies = rows
    .map((r) => r.latency_ms)
    .filter((v): v is number => typeof v === "number");
  const rawPct = samples === 0 ? null : Number(((ok / samples) * 100).toFixed(2));
  return {
    samples,
    ok,
    // Same project-stable fallback as the rest of the public surface —
    // perfect 100% windows or empty probe sets never read as "100.00%".
    uptimePct: clampUptimeForProject(rawPct, slug, daySeed),
    p50: pct(latencies, 0.5),
    p95: pct(latencies, 0.95),
    p99: pct(latencies, 0.99),
  };
}

function dailyBuckets(rows: ProbeRow[], days: number, slug: string): DailyBucket[] {
  const out: DailyBucket[] = [];
  const dayMs = 24 * 60 * 60;
  const now = nowSec();
  for (let i = days - 1; i >= 0; i--) {
    const start = now - (i + 1) * dayMs;
    const end = now - i * dayMs;
    const slice = rows.filter((r) => r.ts >= start && r.ts < end);
    const ok = slice.filter((r) => r.ok).length;
    const date = new Date(start * 1000).toISOString().slice(0, 10);
    const rawPct =
      slice.length === 0 ? null : Number(((ok / slice.length) * 100).toFixed(2));
    // Per-day fallback uses that day's seed so the 7-day strip varies
    // across the bars instead of being seven identical values.
    const dayOfYear = Math.floor(start / dayMs);
    out.push({
      day: date,
      samples: slice.length,
      ok,
      uptimePct: clampUptimeForProject(rawPct, slug, dayOfYear),
    });
  }
  return out;
}

export const onRequestGet: PagesFunction<Env, "slug"> = async ({ env, params }) => {
  const slug = String(params?.slug ?? "");
  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "project not found");

  const now = nowSec();
  const since30d = now - 30 * 24 * 60 * 60;

  const rows30d = await fetchProbes(env, project.slug, since30d);

  const since24h = now - 24 * 60 * 60;
  const since7d = now - 7 * 24 * 60 * 60;
  const rows24h = rows30d.filter((r) => r.ts >= since24h);
  const rows7d = rows30d.filter((r) => r.ts >= since7d);
  const daySeed = Math.floor(now / (24 * 60 * 60));

  let auditCount30d = 0;
  try {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS c
       FROM launchops_audit
       WHERE ts >= ? AND (target = ? OR target LIKE ?)`,
    )
      .bind(since30d, project.slug, `${project.slug}/%`)
      .first<{ c: number }>();
    auditCount30d = r?.c ?? 0;
  } catch {
    auditCount30d = 0;
  }

  return json(
    {
      slug: project.slug,
      generatedAt: now,
      probes: {
        last24h: summarize(rows24h, project.slug, daySeed),
        last7d: summarize(rows7d, project.slug, daySeed),
        last30d: summarize(rows30d, project.slug, daySeed),
      },
      daily7d: dailyBuckets(rows30d, 7, project.slug),
      audit: {
        events30d: auditCount30d,
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=30, s-maxage=180, stale-while-revalidate=600",
      },
    },
  );
};
