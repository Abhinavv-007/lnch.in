import { Activity } from "lucide-react";
import { useState, useRef, type CSSProperties, type MouseEvent, type FocusEvent } from "react";
import { fmtCount, fmtRps } from "@/lib/format";

/**
 * Public traffic heatmap (events by day-of-week × hour-of-day, last 7 days).
 *
 * Sourced from real LaunchOps event tables in D1 — every probe and every
 * audit event lights up the corresponding cell, plus a backfill of the
 * launch-month traffic so the field reads as actively used. Cells animate
 * scale + glow on hover and surface a rich tooltip with the full bucket.
 *
 * Visual is one of the headline posters of the public surface — scalloped
 * ticket border, dotted paper grid, serif italic accent, mono day/hour
 * labels, gold legend chips, and a peak/total summary strip.
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

const EMPTY_GRID: number[][] = Array.from({ length: 7 }, () =>
  Array.from({ length: 24 }, () => 0),
);

type HoverInfo = {
  day: string;
  hour: number;
  count: number;
  left: number;
  top: number;
};

function tierLabel(count: number): string {
  if (count >= 10_000) return "extreme";
  if (count >= 1_000) return "high";
  if (count >= 100) return "active";
  if (count >= 10) return "warm";
  if (count > 0) return "light";
  return "idle";
}

export default function HeatmapPoster({ data }: { data: HeatmapData | null }) {
  const cells = data?.cells?.length === 7 ? data.cells : EMPTY_GRID;
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showHover = (
    e: MouseEvent | FocusEvent,
    day: string,
    hour: number,
    count: number,
  ) => {
    const target = e.currentTarget as HTMLElement;
    const root = containerRef.current;
    if (!root) return;
    const tRect = target.getBoundingClientRect();
    const rRect = root.getBoundingClientRect();
    setHover({
      day,
      hour,
      count,
      left: tRect.left - rRect.left + tRect.width / 2,
      top: tRect.top - rRect.top,
    });
  };
  const clearHover = () => setHover(null);

  return (
    <div ref={containerRef} className="poster-card relative">
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

      <div className="mt-8 overflow-x-auto" style={{ overflowY: "hidden" }}>
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
                const selected =
                  hover != null && hover.day === d && hover.hour === hi;
                return (
                  <span
                    key={hi}
                    role="button"
                    tabIndex={0}
                    aria-label={`${d} ${hi.toString().padStart(2, "0")}:00 — ${fmtRps(rps)} events`}
                    className={`heatmap-cell ${selected ? "heatmap-cell--selected" : ""}`}
                    style={cellStyle}
                    onMouseEnter={(e) => showHover(e, d, hi, rps)}
                    onMouseLeave={clearHover}
                    onFocus={(e) => showHover(e, d, hi, rps)}
                    onBlur={clearHover}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {hover ? (
        <div
          role="tooltip"
          className="poster-tooltip"
          style={{ left: hover.left, top: hover.top }}
        >
          <div className="poster-tooltip__head">
            <span>API · Heatmap</span>
            <span>{tierLabel(hover.count)}</span>
          </div>
          <div className="poster-tooltip__row">
            <span className="poster-tooltip__label">When</span>
            <span className="poster-tooltip__value">
              {hover.day} · {hover.hour.toString().padStart(2, "0")}:00 UTC
            </span>
            <span className="poster-tooltip__label">Events</span>
            <span className="poster-tooltip__value">{fmtCount(hover.count)}</span>
            <span className="poster-tooltip__label">Tier</span>
            <span className="poster-tooltip__value">tier {tier(hover.count)} / 4</span>
          </div>
        </div>
      ) : null}

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
              {fmtRps(data.peak.rps)}{" "}
              <span className="font-mono text-xs lowercase tracking-wide text-muted">
                events/h
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
              fmtCount(data.totalRequests)
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
