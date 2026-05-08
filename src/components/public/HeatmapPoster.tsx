import { Activity } from "lucide-react";
import type { CSSProperties } from "react";

/**
 * Public traffic heatmap (events by day-of-week × hour-of-day, last 7 days).
 *
 * Sourced from real LaunchOps event tables in D1 — every health probe and
 * every audit event lights up the corresponding cell. Cells start small
 * and accumulate; the moment any of the project APIs receive traffic and
 * pipes it into D1, the grid grows.
 *
 * The visual is one of the headline posters of the public surface —
 * scalloped ticket border, dotted paper grid, serif italic accent, mono
 * day/hour labels, gold legend chips, and a peak/total summary strip.
 */
export type HeatmapData = {
  /** 7 rows (Mon..Sun) × 24 cols (00..23) of event-count values. */
  cells: number[][];
  peak?: { day: string; hour: number; rps: number } | null;
  totalRequests?: number | null;
  /** True once any real event has landed in the window (always real data). */
  available: boolean;
  windowDays?: number;
  sources?: { probes: number; audits: number };
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOUR_TICKS = new Set([0, 4, 8, 12, 16, 20]);

function tier(rps: number): 0 | 1 | 2 | 3 | 4 {
  if (rps <= 0) return 0;
  if (rps < 10) return 1;
  if (rps < 100) return 2;
  if (rps < 1_000) return 3;
  return 4;
}

const CELL_VAR = [
  "var(--heatmap-empty)",
  "var(--heatmap-tier-1)",
  "var(--heatmap-tier-2)",
  "var(--heatmap-tier-3)",
  "var(--heatmap-tier-4)",
] as const;

const TIER_LEGEND = [
  { label: "0", color: "var(--heatmap-empty)" },
  { label: "10", color: "var(--heatmap-tier-1)" },
  { label: "100", color: "var(--heatmap-tier-2)" },
  { label: "1K", color: "var(--heatmap-tier-3)" },
  { label: "10K+", color: "var(--heatmap-tier-4)" },
];

function fmtRps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function fmtTotal(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

const EMPTY_GRID: number[][] = Array.from({ length: 7 }, () =>
  Array.from({ length: 24 }, () => 0),
);

export default function HeatmapPoster({ data }: { data: HeatmapData | null }) {
  const cells = data?.cells?.length === 7 ? data.cells : EMPTY_GRID;

  return (
    <div className="poster-card relative">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="poster-eyebrow">when traffic hits</p>
          <h3 className="poster-headline poster-headline--md mt-2">
            The <span className="accent">heatmap.</span>
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-fg-soft">
            Live API events by day and hour. Updates as soon as any project's API is hit.
          </p>
        </div>
        <span className="poster-stamp">
          <Activity className="h-3 w-3" />
          live
        </span>
      </div>

      <div className="mt-8 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="heatmap-grid mb-2">
            <span className="heatmap-day" />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="heatmap-hour">
                {HOUR_TICKS.has(h) ? `${h.toString().padStart(2, "0")}` : ""}
              </span>
            ))}
          </div>

          {DAYS.map((d, di) => (
            <div key={d} className="heatmap-grid mb-1">
              <span className="heatmap-day">{d}</span>
              {(cells[di] ?? EMPTY_GRID[di]).map((rps, hi) => {
                const t = tier(rps);
                const cellVar = CELL_VAR[t];
                const cellStyle = {
                  ["--cell" as string]: cellVar,
                } as CSSProperties;
                return (
                  <span
                    key={hi}
                    className="heatmap-cell"
                    style={cellStyle}
                    title={`${d} ${hi.toString().padStart(2, "0")}:00 · ${fmtRps(rps)} RPS`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="font-mono uppercase tracking-[0.22em]">RPS</span>
        {TIER_LEGEND.map((t) => (
          <span key={t.label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3 w-5 rounded-sm"
              style={{ background: t.color }}
            />
            <span className="font-mono lowercase tracking-wider">
              {t.label}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="poster-stat poster-stat--block">
          <p className="poster-stat__label">Peak traffic</p>
          {data?.peak ? (
            <p className="poster-stat__value">
              ~{fmtRps(data.peak.rps)}{" "}
              <span className="font-mono text-xs lowercase tracking-wide text-muted">
                rps
              </span>
            </p>
          ) : (
            <p className="poster-stat__value text-muted">—</p>
          )}
          <p className="poster-stat__hint">
            {data?.peak
              ? `${data.peak.day} · ${data.peak.hour.toString().padStart(2, "0")}:00`
              : "no peak yet"}
          </p>
        </div>
        <div className="poster-stat poster-stat--block">
          <p className="poster-stat__label">All time</p>
          <p className="poster-stat__value">
            {data?.totalRequests != null ? (
              fmtTotal(data.totalRequests)
            ) : (
              <span className="text-muted">—</span>
            )}
          </p>
          <p className="poster-stat__hint">total requests</p>
        </div>
      </div>

      <div className="poster-footer-strip mt-6">
        <span className="poster-footer-strip__brand">
          <span className="poster-bullet" />
          LNCH.IN
        </span>
        <span>{`last ${data?.windowDays ?? 7} days`}</span>
      </div>
    </div>
  );
}
