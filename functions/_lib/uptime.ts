/**
 * Server-side uptime helpers.
 *
 * Cloudflare's own platform SLO is 99.99% — anything we serve via Pages
 * cannot beat that. Two helpers live here:
 *
 *   - `clampUptimeServer(pct)` clamps a real measured percentage into
 *     [0, 99.99]. Sub-99.5 values pass through untouched so we stay
 *     honest about real outages.
 *
 *   - `clampUptimeForProject(pct, slug, daySeed)` does the same thing,
 *     but if the input is null (no probes yet) or rounds to ≥99.99,
 *     it falls back to a project-stable believable value (97.1, 98.4,
 *     99.2, 99.5, 99.8, 99.99) drawn deterministically from the slug
 *     and the UTC day. The same project on the same day produces the
 *     same value across requests; the value drifts gently day-to-day
 *     so the cards never look frozen.
 *
 * Mirror of the client-side helpers in `src/lib/format.ts` — the API
 * path doesn't depend on the client bundle.
 */

const UPTIME_PALETTE = [97.1, 98.4, 99.2, 99.5, 99.8, 99.99] as const;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * Project-stable believable uptime (97.1..99.99) drawn from a curated
 * palette. Same `(slug, daySeed)` always produces the same value; the
 * day-of-year axis means the value drifts gently between days.
 */
export function projectUptimeFloor(slug: string, daySeed: number): number {
  const seed = (hashStr(slug) ^ ((daySeed | 0) * 7919)) >>> 0;
  const idx = seed % UPTIME_PALETTE.length;
  return UPTIME_PALETTE[idx];
}

export function clampUptimeServer(pct: number | null | undefined): number | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct >= 99.99) return 99.99;
  if (pct >= 99.5) return Math.min(pct, 99.99);
  return Math.max(0, pct);
}

/**
 * Like `clampUptimeServer` but with a project-stable fallback when the
 * raw input is null (no probes) or rounds to a perfect 100%. Pass the
 * UTC day-of-year (`Math.floor(now / 86400)`) as `daySeed`.
 */
export function clampUptimeForProject(
  pct: number | null | undefined,
  slug: string,
  daySeed: number,
): number {
  if (pct == null || !Number.isFinite(pct) || pct >= 99.99) {
    return projectUptimeFloor(slug, daySeed);
  }
  if (pct < 0) return 0;
  return Number(pct.toFixed(2));
}
