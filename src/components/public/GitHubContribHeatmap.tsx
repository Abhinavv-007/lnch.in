import { Github } from "lucide-react";
import { useRef, useState, type CSSProperties, type MouseEvent, type FocusEvent } from "react";
import { fmtCount } from "@/lib/format";

/**
 * Public GitHub contribution heatmap.
 *
 * Mirrors the API heatmap visual language (scalloped ticket border, dotted
 * paper grid, gold legend, peak/total stat strip) so the two posters read
 * as a pair — one for project API activity, one for the upstream
 * commit/issue/PR activity that produces those projects.
 *
 * Data is the standard GitHub contribution-calendar shape (53 weeks × 7
 * days). Server-side fetched via `GITHUB_TOKEN`; we never round-trip the
 * token through the browser.
 */
export type ContribDay = {
  date: string;
  count: number;
  weekday: number;
  color?: string;
};

export type ContribData = {
  login: string;
  totalContributions: number;
  weeks: { firstDay: string; days: ContribDay[] }[];
  available: boolean;
  source?: "github" | "cache";
};

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const TIER_LEGEND = [
  { label: "0", color: "var(--gh-tier-0)" },
  { label: "1", color: "var(--gh-tier-1)" },
  { label: "5", color: "var(--gh-tier-2)" },
  { label: "12", color: "var(--gh-tier-3)" },
  { label: "20+", color: "var(--gh-tier-4)" },
];

function tier(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 12) return 2;
  if (count < 20) return 3;
  return 4;
}

const TIER_VAR = [
  "var(--gh-tier-0)",
  "var(--gh-tier-1)",
  "var(--gh-tier-2)",
  "var(--gh-tier-3)",
  "var(--gh-tier-4)",
] as const;

/** Find the dominant weekday for monthly tick rendering above the grid. */
function monthTicks(weeks: ContribData["weeks"]): { weekIndex: number; label: string }[] {
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

function contribTier(count: number): string {
  if (count >= 20) return "extreme";
  if (count >= 12) return "high";
  if (count >= 5) return "active";
  if (count >= 1) return "light";
  return "idle";
}

export default function GitHubContribHeatmap({
  data,
  profileUrl,
}: {
  data: ContribData | null;
  profileUrl: string;
}) {
  const weeks = data?.weeks ?? [];
  const ticks = monthTicks(weeks);
  const total = data?.totalContributions ?? 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  let peak: ContribDay | null = null;
  for (const w of weeks) {
    for (const d of w.days) {
      if (!peak || d.count > peak.count) peak = d;
    }
  }
  const empty = !data?.available || total === 0;

  const showHover = (e: MouseEvent | FocusEvent, day: ContribDay) => {
    const target = e.currentTarget as HTMLElement;
    const root = containerRef.current;
    if (!root) return;
    const tRect = target.getBoundingClientRect();
    const rRect = root.getBoundingClientRect();
    // Clamp inside the card so the tooltip never extends past the right
    // edge (which used to push the page wider and surface a horizontal
    // scrollbar on hover).
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

  return (
    <div ref={containerRef} className="poster-card relative">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="poster-eyebrow">commits, issues, prs</p>
          <h3 className="poster-headline poster-headline--md mt-2">
            The <span className="accent">github calendar.</span>
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-fg-soft">
            One year of public GitHub activity for{" "}
            <code className="text-accent">{data?.login ?? "Abhinavv-007"}</code>.
          </p>
        </div>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="poster-stamp poster-stamp--link inline-flex items-center gap-1.5"
          title="Open GitHub profile"
        >
          <Github className="h-3 w-3" />
          github
        </a>
      </div>

      {/* `overflow: hidden` keeps the calendar contained — the cells shrink
          to fit the card width on narrow viewports instead of forcing a
          horizontal scrollbar that flickers in/out on hover. */}
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
                const style = {
                  ["--cell" as string]: TIER_VAR[t],
                } as CSSProperties;
                const selected =
                  hover != null && day != null && hover.date === day.date;
                return (
                  <span
                    key={wi}
                    role="button"
                    tabIndex={day ? 0 : -1}
                    aria-label={
                      day ? `${day.date} — ${day.count} contributions` : ""
                    }
                    className={`gh-contrib__cell ${selected ? "heatmap-cell--selected" : ""}`}
                    style={style}
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
            <span>GitHub</span>
            <span>{contribTier(hover.count)}</span>
          </div>
          <div className="poster-tooltip__row">
            <span className="poster-tooltip__label">Date</span>
            <span className="poster-tooltip__value">{hover.date}</span>
            <span className="poster-tooltip__label">Day</span>
            <span className="poster-tooltip__value">
              {DAY_LABEL[hover.weekday] ?? ""}
            </span>
            <span className="poster-tooltip__label">Contribs</span>
            <span className="poster-tooltip__value">
              {fmtCount(hover.count)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="font-mono uppercase tracking-[0.22em]">contributions</span>
        {TIER_LEGEND.map((t) => (
          <span key={t.label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3 w-5 rounded-sm"
              style={{ background: t.color }}
            />
            <span className="font-mono lowercase tracking-wider">{t.label}</span>
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="poster-stat poster-stat--block">
          <p className="poster-stat__label">Most active day</p>
          {peak && peak.count > 0 ? (
            <p className="poster-stat__value">
              {fmtCount(peak.count)}{" "}
              <span className="font-mono text-xs lowercase tracking-wide text-muted">
                contribs
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
            {empty ? <span className="text-muted">—</span> : fmtCount(total)}
          </p>
          <p className="poster-stat__hint">total contributions</p>
        </div>
      </div>

      <div className="poster-footer-strip mt-6">
        <span className="poster-footer-strip__brand">
          <span className="poster-bullet" />
          GITHUB · {data?.login ?? "Abhinavv-007"}
        </span>
        <span>last 53 weeks</span>
      </div>
    </div>
  );
}
