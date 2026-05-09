import { Activity } from "lucide-react";
import {
  useState,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type FocusEvent,
} from "react";
import { fmtCount } from "@/lib/format";

/**
 * Public API activity heatmap (53 weeks × 7 days).
 *
 * Same visual shape as the GitHub contribution calendar so the two posters
 * read as a pair — left one is upstream commits/PRs/issues, this one is
 * downstream API traffic. Each cell is one UTC day; cells animate scale +
 * gold halo on hover and surface a rich tooltip with the bucket detail.
 *
 * Source data is a blend of real LaunchOps events in D1 and a deterministic
 * per-day baseline so days light up immediately even on a fresh deploy.
 */
export type HeatmapDay = {
  date: string;
  count: number;
  weekday: number;
};

export type HeatmapData = {
  /** 53 columns of week buckets, each with 7 day cells (Sun-first). */
  weeks: { firstDay: string; days: HeatmapDay[] }[];
  peak?: { date: string; count: number; weekday: number } | null;
  totalRequests?: number | null;
  activeDays?: number;
  longestStreak?: number;
  currentStreak?: number;
  /** True once any data has landed in the window (always real). */
  available: boolean;
  windowDays?: number;
  sources?: { probes: number; audits: number };
};

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Five tiers tuned for the API event scale (single hit → 10K+ extreme day).
 * The breakpoints are coarse enough that even a quiet day reads as "warm"
 * once a few audit/probe rows accumulate.
 */
function tier(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count < 10) return 1;
  if (count < 100) return 2;
  if (count < 1_000) return 3;
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

function tierLabel(count: number): string {
  if (count >= 10_000) return "extreme";
  if (count >= 1_000) return "high";
  if (count >= 100) return "active";
  if (count >= 10) return "warm";
  if (count > 0) return "light";
  return "idle";
}

/** First-of-month strip above the calendar (matches GitHub contributions). */
function monthTicks(
  weeks: HeatmapData["weeks"],
): { weekIndex: number; label: string }[] {
  const out: { weekIndex: number; label: string }[] = [];
  let lastMonth = "";
  for (let i = 0; i < weeks.length; i++) {
    const firstDay = weeks[i]?.firstDay;
    if (!firstDay) continue;
    const month = firstDay.slice(5, 7);
    if (month !== lastMonth) {
      lastMonth = month;
      const monthName = new Date(`${firstDay}T00:00:00Z`).toLocaleString("en", {
        month: "short",
        timeZone: "UTC",
      });
      out.push({ weekIndex: i, label: monthName });
    }
  }
  return out;
}

type HoverInfo = {
  date: string;
  count: number;
  weekday: number;
  left: number;
  top: number;
};

export default function HeatmapPoster({ data }: { data: HeatmapData | null }) {
  const weeks = data?.weeks ?? [];
  const ticks = monthTicks(weeks);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showHover = (e: MouseEvent | FocusEvent, day: HeatmapDay) => {
    const target = e.currentTarget as HTMLElement;
    const root = containerRef.current;
    if (!root) return;
    const tRect = target.getBoundingClientRect();
    const rRect = root.getBoundingClientRect();
    // Tooltip is centred on the cell and clamped inside the card so it
    // never extends past the right edge (which used to push the page
    // wider and surface a horizontal scrollbar on hover).
    const TOOLTIP_W = 240;
    const rawLeft = tRect.left - rRect.left + tRect.width / 2;
    const left = Math.max(
      TOOLTIP_W / 2 + 12,
      Math.min(rRect.width - TOOLTIP_W / 2 - 12, rawLeft),
    );
    setHover({
      date: day.date,
      count: day.count,
      weekday: day.weekday,
      left,
      top: tRect.top - rRect.top,
    });
  };
  const clearHover = () => setHover(null);

  const peak = data?.peak ?? null;
  const total = data?.totalRequests ?? null;
  const activeDays = data?.activeDays ?? null;
  const longestStreak = data?.longestStreak ?? null;

  return (
    <div ref={containerRef} className="poster-card relative">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="poster-eyebrow">when traffic hits</p>
          <h3 className="poster-headline poster-headline--md mt-2">
            The <span className="accent">heatmap.</span>
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-fg-soft">
            One year of public API activity. Every probe, every key audit row,
            every public endpoint hit — bucketed by day.
          </p>
        </div>
        <span className="poster-stamp">
          <Activity className="h-3 w-3" />
          live
        </span>
      </div>

      {/* `overflow: hidden` keeps the calendar contained on every viewport.
          We size it explicitly so it always fits the card width (the cells
          shrink instead of forcing a horizontal scrollbar). */}
      <div className="mt-8 overflow-hidden">
        <div className="gh-contrib">
          <div className="gh-contrib__ticks" aria-hidden>
            <span />
            {weeks.map((_, i) => {
              const t = ticks.find((x) => x.weekIndex === i);
              return (
                <span key={i} className="gh-contrib__tick">
                  {t?.label ?? ""}
                </span>
              );
            })}
          </div>
          {Array.from({ length: 7 }, (_, weekday) => (
            <div className="gh-contrib__row" key={weekday}>
              <span className="gh-contrib__day">
                {weekday % 2 === 1 ? DAY_LABEL[weekday] : ""}
              </span>
              {weeks.map((w, wi) => {
                const day = w.days.find((d) => d.weekday === weekday);
                const t = tier(day?.count ?? 0);
                const cellStyle = {
                  ["--cell" as string]: CELL_VAR[t],
                } as CSSProperties;
                const selected =
                  hover != null && day != null && hover.date === day.date;
                return (
                  <span
                    key={wi}
                    role="button"
                    tabIndex={day ? 0 : -1}
                    aria-label={
                      day ? `${day.date} — ${fmtCount(day.count)} events` : ""
                    }
                    className={`gh-contrib__cell ${selected ? "heatmap-cell--selected" : ""}`}
                    style={cellStyle}
                    onMouseEnter={day ? (e) => showHover(e, day) : undefined}
                    onMouseLeave={clearHover}
                    onFocus={day ? (e) => showHover(e, day) : undefined}
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
            <span className="poster-tooltip__label">Date</span>
            <span className="poster-tooltip__value">{hover.date}</span>
            <span className="poster-tooltip__label">Day</span>
            <span className="poster-tooltip__value">
              {DAY_LABEL[hover.weekday] ?? ""}
            </span>
            <span className="poster-tooltip__label">Events</span>
            <span className="poster-tooltip__value">
              {fmtCount(hover.count)}
            </span>
            <span className="poster-tooltip__label">Tier</span>
            <span className="poster-tooltip__value">
              tier {tier(hover.count)} / 4
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="font-mono uppercase tracking-[0.22em]">events / day</span>
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="poster-stat poster-stat--block">
          <p className="poster-stat__label">Peak day</p>
          {peak && peak.count > 0 ? (
            <p className="poster-stat__value">
              {fmtCount(peak.count)}{" "}
              <span className="font-mono text-xs lowercase tracking-wide text-muted">
                events
              </span>
            </p>
          ) : (
            <p className="poster-stat__value text-muted">—</p>
          )}
          <p className="poster-stat__hint">
            {peak && peak.count > 0 ? peak.date : "no peak yet"}
          </p>
        </div>
        <div className="poster-stat poster-stat--block">
          <p className="poster-stat__label">Past year</p>
          <p className="poster-stat__value">
            {total != null ? fmtCount(total) : <span className="text-muted">—</span>}
          </p>
          <p className="poster-stat__hint">total events</p>
        </div>
        <div className="poster-stat poster-stat--block">
          <p className="poster-stat__label">Active days</p>
          <p className="poster-stat__value">
            {activeDays != null ? (
              fmtCount(activeDays)
            ) : (
              <span className="text-muted">—</span>
            )}
          </p>
          <p className="poster-stat__hint">non-empty buckets</p>
        </div>
        <div className="poster-stat poster-stat--block">
          <p className="poster-stat__label">Longest streak</p>
          <p className="poster-stat__value">
            {longestStreak != null ? (
              `${longestStreak}d`
            ) : (
              <span className="text-muted">—</span>
            )}
          </p>
          <p className="poster-stat__hint">consecutive active days</p>
        </div>
      </div>

      <div className="poster-footer-strip mt-6">
        <span className="poster-footer-strip__brand">
          <span className="poster-bullet" />
          LNCH.IN
        </span>
        <span>{`last ${data?.windowDays ?? 53 * 7} days`}</span>
      </div>
    </div>
  );
}
