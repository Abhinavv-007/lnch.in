import { Github } from "lucide-react";
import type { CSSProperties } from "react";

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

function fmtTotal(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

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
  // Find peak day for the summary stat.
  let peak: ContribDay | null = null;
  for (const w of weeks) {
    for (const d of w.days) {
      if (!peak || d.count > peak.count) peak = d;
    }
  }
  const empty = !data?.available || total === 0;

  return (
    <div className="poster-card relative">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="poster-eyebrow">commits, issues, prs</p>
          <h3 className="poster-headline poster-headline--md mt-2">
            The <span className="accent">github calendar.</span>
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-fg-soft">
            One year of public GitHub activity for <code className="text-accent">{data?.login ?? "Abhinavv-007"}</code>.
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

      <div className="mt-8 overflow-x-auto">
        <div className="gh-contrib min-w-[760px]">
          {/* Month ticks */}
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
          {/* 7 rows × N week-cols */}
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
                return (
                  <span
                    key={wi}
                    className="gh-contrib__cell"
                    style={style}
                    title={
                      day
                        ? `${day.date} · ${day.count} contribution${day.count === 1 ? "" : "s"}`
                        : ""
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

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
              {peak.count}{" "}
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
            {empty ? <span className="text-muted">—</span> : fmtTotal(total)}
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
