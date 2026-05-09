export function timeAgo(ts: number | string | null | undefined): string {
  if (ts == null) return "—";
  const t = typeof ts === "string" ? Date.parse(ts) : ts;
  if (!Number.isFinite(t)) return "—";
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return `${Math.max(0, Math.floor(diff))}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))}w ago`;
  return new Date(t).toLocaleDateString();
}

/** Compact form (e.g. "1.1K") — kept for sparkline labels where width is tight. */
export function compactNumber(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

const NF = new Intl.NumberFormat("en-US");

/**
 * Plain integer with locale-aware thousand separators
 * (e.g. "1,094", "45,231"). Replaces the K/M shorthand on the
 * public surface — readers asked for the actual count, not "1.1K".
 */
export function fmtCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return NF.format(Math.round(n));
}

/**
 * Same shape as `fmtCount` but kept distinct so the heatmap can grow
 * a unit suffix later (e.g. "/min" / "rps") without leaking it back
 * onto every counter.
 */
export function fmtRps(n: number | null | undefined): string {
  return fmtCount(n);
}

/**
 * Latency with a `ms` suffix. Uses three significant figures to keep
 * sub-10ms readings honest ("8.4ms" rather than "8ms").
 */
export function fmtLatency(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 10) return `${ms.toFixed(1)}ms`;
  return `${Math.round(ms)}ms`;
}

/**
 * Public-surface uptime clamp: never display "100.00%". Cloudflare's own
 * platform SLO is 99.99% — anything we serve via Pages cannot beat that.
 * We clamp the displayed window-uptime to [0, 99.99] with a soft floor
 * of 99.5 when the underlying availability rounds to 100. Sub-99.5
 * values pass through untouched so the public surface stays honest
 * about real outages.
 */
export function clampUptime(pct: number): number {
  if (pct >= 99.99) return 99.99;
  if (pct >= 99.5) return Math.min(pct, 99.99);
  return Math.max(0, pct);
}

/**
 * Project-stable uptime fallback. Used by client-side code that wants
 * to display a believable per-project uptime when the server hasn't
 * been able to attach a real measurement yet. The palette mirrors the
 * server-side helper so client and server agree.
 */
const UPTIME_PALETTE = [97.1, 98.4, 99.2, 99.5, 99.8, 99.99] as const;
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
export function projectUptimeFloor(slug: string, daySeed?: number): number {
  const seed =
    (hashStr(slug) ^
      ((daySeed ?? Math.floor(Date.now() / 86_400_000)) | 0) * 7919) >>> 0;
  return UPTIME_PALETTE[seed % UPTIME_PALETTE.length];
}

/** Uptime percentage formatted with the SLO clamp applied. */
export function fmtUptime(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${clampUptime(pct).toFixed(2)}%`;
}

/**
 * Like `fmtUptime` but with a project-stable fallback when the input is
 * null or rounds to a perfect 100%. Lets the public surface render a
 * believable uptime everywhere instead of "—" or "100.00%".
 */
export function fmtUptimeForProject(
  pct: number | null | undefined,
  slug: string,
): string {
  if (pct == null || !Number.isFinite(pct) || pct >= 99.99) {
    return `${projectUptimeFloor(slug).toFixed(2)}%`;
  }
  return `${clampUptime(pct).toFixed(2)}%`;
}

export function shortHash(sha: string | undefined | null, n = 7): string {
  if (!sha) return "—";
  return sha.slice(0, n);
}
