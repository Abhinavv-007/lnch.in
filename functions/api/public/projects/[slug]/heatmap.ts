/**
 * GET /api/public/projects/:slug/heatmap
 *
 * Per-project 7×24 (day-of-week × hour-of-day) activity heatmap, scoped to
 * the requested slug. Sourced from real LaunchOps event tables in D1:
 *
 *   - `launchops_health_snapshots`  — every probe row counts as one event
 *   - `launchops_audit`             — every audit row whose target is the
 *                                     project (or a sub-target like
 *                                     `<slug>/something`) counts too
 *
 * Window: last 7 days, UTC. Cells are raw counts; the frontend tiers them
 * (10 / 100 / 1K / 10K+) so a few hundred events already produce a visible
 * footprint without needing fabricated data.
 */
import { type Env, err, json, nowSec } from "../../../../_lib/env";
import { PROJECT_BY_SLUG } from "../../../../_lib/projects";

type HourRow = { ts: number; cnt: number };

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function emptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
}

export const onRequestGet: PagesFunction<Env, "slug"> = async ({ env, params }) => {
  const slug = String(params?.slug ?? "");
  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "project not found");

  const now = nowSec();
  const since = now - 7 * 24 * 60 * 60;

  const probesRows = async (): Promise<HourRow[]> => {
    try {
      const r = await env.DB.prepare(
        `SELECT ts, 1 AS cnt
         FROM launchops_health_snapshots
         WHERE project_slug = ? AND ts >= ?`,
      )
        .bind(project.slug, since)
        .all<HourRow>();
      return r.results ?? [];
    } catch {
      return [];
    }
  };

  const auditRows = async (): Promise<HourRow[]> => {
    try {
      const r = await env.DB.prepare(
        `SELECT ts, 1 AS cnt
         FROM launchops_audit
         WHERE ts >= ?
           AND (target = ? OR target LIKE ?)`,
      )
        .bind(since, project.slug, `${project.slug}/%`)
        .all<HourRow>();
      return r.results ?? [];
    } catch {
      return [];
    }
  };

  const [probes, audits] = await Promise.all([probesRows(), auditRows()]);

  const cells = emptyGrid();
  const indexInto = (rows: HourRow[]) => {
    for (const r of rows) {
      if (!Number.isFinite(r.ts)) continue;
      const d = new Date(r.ts * 1000);
      const jsDow = d.getUTCDay();
      // Match the global heatmap layout: Mon=0..Sun=6.
      const monFirst = (jsDow + 6) % 7;
      const hour = d.getUTCHours();
      cells[monFirst][hour] += 1;
    }
  };
  indexInto(probes);
  indexInto(audits);

  let peak: { day: string; hour: number; rps: number } | null = null;
  let peakValue = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const v = cells[d][h];
      if (v > peakValue) {
        peakValue = v;
        peak = { day: DAY_LABEL[(d + 1) % 7], hour: h, rps: v };
      }
    }
  }

  const total = probes.length + audits.length;

  return json(
    {
      slug: project.slug,
      cells,
      peak,
      totalRequests: total,
      available: total > 0,
      generatedAt: now,
      windowDays: 7,
      sources: {
        probes: probes.length,
        audits: audits.length,
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
};
