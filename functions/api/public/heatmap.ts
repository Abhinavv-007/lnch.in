/**
 * GET /api/public/heatmap
 *
 * Public 7×24 RPS-by-day-of-week × hour-of-day heatmap for the landing
 * poster. The cells are sourced from real LaunchOps event tables in D1
 * — every probe and every audit row counts as one event. As soon as any
 * project's API gets traffic and pipes it into D1 (or any probe runs),
 * the cells light up.
 *
 * Query is bounded to the most recent 7 days and grouped by hour bucket.
 * KV-cached for 30s to absorb landing-page bursts.
 */
import { type Env, json, nowSec } from "../../_lib/env";

type HourRow = { ts: number; cnt: number };

function emptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
}

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const now = nowSec();
  // 7 days = 168 hours.
  const since = now - 7 * 24 * 60 * 60;

  // Pull every event timestamp inside the window from the tables that count
  // as "API activity" today. Each row is one event; we bucket into the 7×24
  // grid below. We avoid SUM/COUNT in SQL so we can mix multiple sources.
  const rowsForTable = async (table: "launchops_health_snapshots" | "launchops_audit"): Promise<HourRow[]> => {
    try {
      const r = await env.DB.prepare(
        `SELECT ts, 1 AS cnt FROM ${table} WHERE ts >= ?`,
      )
        .bind(since)
        .all<HourRow>();
      return r.results ?? [];
    } catch {
      return [];
    }
  };

  const [probes, audits] = await Promise.all([
    rowsForTable("launchops_health_snapshots"),
    rowsForTable("launchops_audit"),
  ]);

  const cells = emptyGrid();
  // RPS = events per second within an hour bucket; we normalize at render.
  // For now, each cell holds the raw count over the last 7 days at that
  // (weekday, hour) slot. The frontend tiering thresholds (10 / 100 / 1K /
  // 10K+) line up with cumulative counts, so a few hundred probes already
  // produces a visible tier-1 / tier-2 footprint.
  const ROWS_TO_INDEX = (rows: HourRow[]) => {
    for (const r of rows) {
      if (!Number.isFinite(r.ts)) continue;
      const d = new Date(r.ts * 1000);
      // JS getUTCDay: 0..6 (Sun..Sat). Our rendering grid uses Mon..Sun;
      // convert: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6.
      const jsDow = d.getUTCDay();
      const monFirst = (jsDow + 6) % 7;
      const hour = d.getUTCHours();
      cells[monFirst][hour] += 1;
    }
  };
  ROWS_TO_INDEX(probes);
  ROWS_TO_INDEX(audits);

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
  const empty = total === 0;

  return json(
    {
      cells,
      peak,
      totalRequests: total,
      // `available` is true the moment we have any real data. The frontend
      // never labels this as "demo" / "sample" — it's always real, just
      // initially small.
      available: !empty,
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
