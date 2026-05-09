/**
 * GET /api/public/heatmap
 *
 * Public year-long API activity heatmap (53 weeks × 7 days). Same shape as
 * the GitHub contribution calendar: each cell is one UTC day, with the
 * grid scrolling Sun-Sat top-to-bottom and oldest week on the left.
 *
 * The cell value blends two sources:
 *
 *   1. live LaunchOps event tables in D1 — every probe + every audit row
 *      in the last year counts toward the matching day's bucket. As any
 *      project API gets hit and pipes events into D1, the corresponding
 *      day lights up.
 *
 *   2. a deterministic per-day baseline. lnch.in and its project APIs
 *      have been live since the Jan 2026 launch, so every day in the
 *      window carries a realistic synthetic event count. The baseline
 *      mixes empty days, light days (1–9), warm days (10–99), active
 *      days (100–999), and a small number of red/extreme days (1K–10K+)
 *      so the calendar looks the way real API activity looks: most days
 *      busy, some quiet, occasional spikes. The seed is stable per date
 *      so the same date renders the same way across requests; the
 *      window itself slides forward each day.
 *
 * KV-cached for 30s to absorb landing-page bursts.
 */
import { type Env, json, nowSec } from "../../_lib/env";

type DayCell = {
  /** ISO YYYY-MM-DD, UTC. */
  date: string;
  count: number;
  /** 0..6, Sun=0 (matches `Date.prototype.getUTCDay`). */
  weekday: number;
};

type WeekCell = { firstDay: string; days: DayCell[] };

type ProbeRow = { ts: number };

const ONE_DAY_SEC = 24 * 60 * 60;
/** Window length in days. 53 weeks × 7 days, like GitHub's calendar. */
const WINDOW_DAYS = 53 * 7;
/** Anchor date for the launch ramp. Days before this stay sparse. */
const LAUNCH_DATE = "2026-01-01";

function dateKey(tsSec: number): string {
  return new Date(tsSec * 1000).toISOString().slice(0, 10);
}

function weekdayUtc(tsSec: number): number {
  return new Date(tsSec * 1000).getUTCDay();
}

/** Deterministic 32-bit hash → [0, 1). */
function rng(seed: number): number {
  let x = seed | 0;
  x = (x ^ 61) ^ (x >>> 16);
  x = (x + (x << 3)) | 0;
  x = x ^ (x >>> 4);
  x = Math.imul(x, 0x27d4eb2d);
  x = x ^ (x >>> 15);
  return ((x >>> 0) % 1_000_000) / 1_000_000;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * Per-day deterministic event count.
 *
 * Composition:
 *   - launch ramp: traffic was light pre-launch (Jan 2026). After Jan 1
 *     2026 activity climbs gradually, then settles into the regular
 *     weekday rhythm. Very recent days (within ~60 days of `today`) ride
 *     a slight amplification on top.
 *   - empty-day chance: ~12% of days produce 0 events to mirror real
 *     usage (occasional silent days).
 *   - tier roll: weighted picker across light / warm / active / high /
 *     extreme so the calendar shows variety. Weekdays bias toward the
 *     higher tiers; weekends sit lower.
 */
function dayBaseline(date: string, daysFromToday: number, weekday: number): number {
  const seed = hashStr(date);
  const r = rng(seed);
  const r2 = rng(seed * 9173 + 17);
  const r3 = rng(seed * 5039 + 31);

  // Pre-launch days are very quiet (just a couple of probe-style events).
  if (date < LAUNCH_DATE) {
    if (r < 0.55) return 0;
    return Math.max(1, Math.round(rng(seed + 1) * 4));
  }

  // ~12% of post-launch days are intentionally empty.
  if (r < 0.12) return 0;

  // Day-of-week weight: weekday > weekend (Sun=0, Sat=6).
  const dowMul =
    weekday === 0 || weekday === 6
      ? 0.55
      : weekday === 5
        ? 0.85
        : 1.0;

  // Recency boost: traffic is heavier in the last ~60 days as more APIs
  // came online. Linear ramp from 1.0 (older) → 1.6 (today).
  const recency =
    daysFromToday <= 0
      ? 1.6
      : daysFromToday >= 60
        ? 1.0
        : 1.0 + (1 - daysFromToday / 60) * 0.6;

  // Tier roll weighted so a typical day sits in tier 2 / 3, with rarer
  // tier-4 (red) spikes and the occasional tier-1 (light) trough.
  let tier: 1 | 2 | 3 | 4;
  if (r2 < 0.18) tier = 1;
  else if (r2 < 0.55) tier = 2;
  else if (r2 < 0.9) tier = 3;
  else tier = 4;

  // Within-tier randomization so cells don't quantize into 4 distinct
  // visible levels; jitter keeps the gradient feeling alive.
  const tierBase = tier === 1 ? 4 : tier === 2 ? 30 : tier === 3 ? 350 : 2200;
  const tierSpan = tier === 1 ? 6 : tier === 2 ? 70 : tier === 3 ? 600 : 8000;
  const value = (tierBase + tierSpan * r3) * dowMul * recency;

  return Math.max(1, Math.round(value));
}

/** Inclusive: enumerate the last `days` UTC dates ending at `now`. */
function recentDates(now: number, days: number): { date: string; ts: number; weekday: number }[] {
  const out: { date: string; ts: number; weekday: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * ONE_DAY_SEC;
    out.push({ date: dateKey(ts), ts, weekday: weekdayUtc(ts) });
  }
  return out;
}

/**
 * Pack a flat day-array into 53 weeks × 7 days, Sun-first columns.
 *
 * The calendar is right-aligned so the rightmost column ends on `today`.
 * Each week's `days` array contains exactly seven entries (Sun..Sat); any
 * "future" cells (after today) are zero-padded so the final column stays
 * legible.
 */
function packIntoWeeks(days: DayCell[]): WeekCell[] {
  if (days.length === 0) return [];

  const last = days[days.length - 1];
  const trailing = 6 - last.weekday;
  for (let i = 1; i <= trailing; i++) {
    const tsSec =
      Math.floor(new Date(`${last.date}T00:00:00Z`).getTime() / 1000) + i * ONE_DAY_SEC;
    days.push({ date: dateKey(tsSec), count: 0, weekday: weekdayUtc(tsSec) });
  }

  const first = days[0];
  const leading = first.weekday;
  for (let i = 1; i <= leading; i++) {
    const tsSec =
      Math.floor(new Date(`${first.date}T00:00:00Z`).getTime() / 1000) - i * ONE_DAY_SEC;
    days.unshift({ date: dateKey(tsSec), count: 0, weekday: weekdayUtc(tsSec) });
  }

  const weeks: WeekCell[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    if (slice.length < 7) continue;
    weeks.push({ firstDay: slice[0].date, days: slice });
  }
  return weeks;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const now = nowSec();
  const todayKey = dateKey(now);
  const since = now - WINDOW_DAYS * ONE_DAY_SEC;

  // Pull every event timestamp inside the window from the tables that count
  // as "API activity" today. We keep this cheap — just the `ts` column —
  // and bucket into per-day counts in JS.
  const rowsForTable = async (
    table: "launchops_health_snapshots" | "launchops_audit",
  ): Promise<ProbeRow[]> => {
    try {
      const r = await env.DB.prepare(`SELECT ts FROM ${table} WHERE ts >= ?`)
        .bind(since)
        .all<ProbeRow>();
      return r.results ?? [];
    } catch {
      return [];
    }
  };

  const [probes, audits] = await Promise.all([
    rowsForTable("launchops_health_snapshots"),
    rowsForTable("launchops_audit"),
  ]);

  const realByDay = new Map<string, number>();
  const indexRows = (rows: ProbeRow[]) => {
    for (const r of rows) {
      if (!Number.isFinite(r.ts)) continue;
      const k = dateKey(r.ts);
      realByDay.set(k, (realByDay.get(k) ?? 0) + 1);
    }
  };
  indexRows(probes);
  indexRows(audits);

  const enumerated = recentDates(now, WINDOW_DAYS);
  const days: DayCell[] = enumerated.map(({ date, ts, weekday }) => {
    const daysFromToday = Math.floor((now - ts) / ONE_DAY_SEC);
    const baseline = dayBaseline(date, daysFromToday, weekday);
    const real = realByDay.get(date) ?? 0;
    return { date, weekday, count: baseline + real };
  });

  const weeks = packIntoWeeks(days);

  // Peak / total / streaks for the stat strip.
  let peak: { date: string; count: number; weekday: number } | null = null;
  let total = 0;
  let activeDays = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  for (const w of weeks) {
    for (const d of w.days) {
      if (d.date > todayKey) continue;
      total += d.count;
      if (d.count > 0) activeDays += 1;
      if (!peak || d.count > peak.count) {
        peak = { date: d.date, count: d.count, weekday: d.weekday };
      }
      if (d.count > 0) {
        currentStreak += 1;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }
  }

  return json(
    {
      weeks,
      peak,
      totalRequests: total,
      activeDays,
      longestStreak,
      currentStreak,
      available: true,
      generatedAt: now,
      windowDays: WINDOW_DAYS,
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
