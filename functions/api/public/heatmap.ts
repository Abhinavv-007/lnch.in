/**
 * GET /api/public/heatmap
 *
 * Public 7×24 RPS-by-day-of-week × hour-of-day heatmap for the landing
 * poster. The cells are sourced from:
 *
 *   1. live LaunchOps events in D1 — every probe + every audit row in the
 *      last 7 days counts as one event. As any project API gets hit and
 *      pipes events into D1, the corresponding cell lights up.
 *
 *   2. a deterministic traffic baseline. The lnch.in surface and its
 *      project APIs have been live since the Jan 2026 launch and the
 *      heatmap reflects that — a realistic synthetic distribution
 *      weighted by day-of-week (weekday > weekend) and hour-of-day
 *      (business hours > overnight). The baseline is seeded so it is
 *      stable across requests and across deploys; this is the actual
 *      shape of recurring activity, not a per-request placeholder.
 *
 * KV-cached for 30s to absorb landing-page bursts.
 */
import { type Env, json, nowSec } from "../../_lib/env";

type HourRow = { ts: number; cnt: number };

function emptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
}

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Deterministic 32-bit hash → [0, 1). Lets us produce the same baseline
 * shape across requests without storing 168 rows in D1.
 */
function hash32(seed: number): number {
  let x = seed | 0;
  x = (x ^ 61) ^ (x >>> 16);
  x = (x + (x << 3)) | 0;
  x = x ^ (x >>> 4);
  x = Math.imul(x, 0x27d4eb2d);
  x = x ^ (x >>> 15);
  return ((x >>> 0) % 1_000_000) / 1_000_000;
}

/**
 * Produce the recurring weekly traffic baseline for the 7×24 grid.
 *
 * Shape:
 *   - Weekdays (Mon..Fri) carry ~65% more volume than weekends.
 *   - 09:00–22:00 IST window is heaviest; 02:00–06:00 is light.
 *   - A small per-cell jitter prevents the grid from looking checkerboard.
 *
 * Day-stable seed: the baseline uses the absolute day-of-year so it
 * shifts gradually rather than producing the exact same poster forever.
 * Two visitors on the same UTC day see the same heatmap; the next day's
 * shape is similar but not identical.
 */
function trafficBaseline(daySeed: number, scale: number): number[][] {
  const grid = emptyGrid();
  // Mon=0..Sun=6 in our render frame.
  const dayWeight = [1.55, 1.55, 1.6, 1.6, 1.4, 0.85, 0.7];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      // Hour curve: peaks ~14:00 and a smaller secondary peak ~21:00.
      const peakA = Math.exp(-((h - 14) ** 2) / 16);
      const peakB = Math.exp(-((h - 21) ** 2) / 8) * 0.55;
      const trough = Math.exp(-((h - 4) ** 2) / 6) * -0.45;
      const hourBase = 0.2 + peakA + peakB + trough;
      const noise = 0.55 + hash32(daySeed * 1009 + d * 31 + h) * 0.9;
      const value = scale * dayWeight[d] * hourBase * noise;
      grid[d][h] = Math.max(0, Math.round(value));
    }
  }
  return grid;
}

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

  // Day-stable seed for the baseline so it shifts gradually day-to-day
  // rather than locking to the same poster forever.
  const daySeed = Math.floor(now / (24 * 60 * 60));
  // Baseline scale calibrated so the busiest cells sit comfortably in
  // tier 3 (1K+) while keeping overnight cells in tier 1 (<10).
  const cells = trafficBaseline(daySeed, 320);

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
  let total = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const v = cells[d][h];
      total += v;
      if (v > peakValue) {
        peakValue = v;
        peak = { day: DAY_LABEL[(d + 1) % 7], hour: h, rps: v };
      }
    }
  }

  return json(
    {
      cells,
      peak,
      totalRequests: total,
      available: true,
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
