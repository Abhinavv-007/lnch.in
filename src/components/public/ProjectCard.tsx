import { Link } from "react-router-dom";
import { Github, Globe, Smartphone, ArrowUpRight } from "lucide-react";
import { type ProjectSummary as StatusProjectSummary } from "@/components/public/StatusTerminal";
import { fmtLatency, fmtUptime } from "@/lib/format";

/**
 * Card-level project shape. Extends the canonical `StatusTerminal`
 * `ProjectSummary` (which the public `/api/public/projects` endpoint emits)
 * with optional fields the card surface uses (blurb, repo, site, mobile apps,
 * accent colour). Keeping a single source of truth means Landing can pass
 * the same array into both components.
 */
export type ProjectSummary = StatusProjectSummary & {
  blurb?: string;
  accent?: string;
  site?: string | null;
  repo?: string | null;
  mobileApps?: { label: string; href?: string; platform?: string }[] | null;
};

const STATE_LABEL: Record<NonNullable<ProjectSummary["health"]>["state"], string> = {
  ok: "online",
  warn: "degraded",
  err: "down",
  unknown: "no data",
};

/**
 * Compact poster-style project card for the public landing page.
 *
 * Reads tone from CSS variables so it retones cleanly in both light and dark
 * mode without per-card hacks. Hover lifts the card and glows the accent
 * border so it feels alive without becoming a generic SaaS box.
 */
export default function ProjectCard({ project }: { project: ProjectSummary }) {
  // Public surface uptime: prefer the server-side clamped value (`uptimePct`,
  // bounded to <100% per Cloudflare's own SLO floor); fall back to deriving
  // it from probe counts and clamping client-side. Either way, we never
  // display a perfect 100.00% reading.
  const okPct =
    typeof project.last24h?.uptimePct === "number"
      ? project.last24h.uptimePct
      : project.last24h && project.last24h.probes
        ? (project.last24h.ok / project.last24h.probes) * 100
        : null;
  const state = project.health?.state ?? "unknown";
  const stamp =
    state === "ok"
      ? "poster-stamp poster-stamp--ok"
      : state === "err"
        ? "poster-stamp poster-stamp--err"
        : state === "warn"
          ? "poster-stamp poster-stamp--warn"
          : "poster-stamp";

  return (
    <Link
      to={`/projects/${project.slug}`}
      className="poster-card poster-card--sm poster-card--hover group relative flex h-full flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-2xl tracking-tight text-fg">{project.name}</p>
          <p className="mt-1 line-clamp-2 text-sm text-fg-soft">{project.blurb}</p>
        </div>
        <span className={stamp}>
          <span aria-hidden className="poster-bullet" />
          {STATE_LABEL[state]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Uptime · 24h" value={fmtUptime(okPct)} />
        <Stat label="p95 · 24h" value={fmtLatency(project.last24h?.p95LatencyMs ?? null)} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-muted">
        {project.site ? (
          <span className="poster-stamp">
            <Globe className="h-3 w-3" /> {new URL(project.site).host}
          </span>
        ) : null}
        {project.repo ? (
          <span className="poster-stamp">
            <Github className="h-3 w-3" /> {project.repo}
          </span>
        ) : null}
        {project.mobileApps?.map((m) => (
          <span key={m.label} className="poster-stamp">
            <Smartphone className="h-3 w-3" /> {m.label}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-fg-soft transition group-hover:text-accent">
          Open <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="poster-stat poster-stat--inline">
      <p className="poster-stat__label">{label}</p>
      <p className="poster-stat__value poster-stat__value--xs">{value}</p>
    </div>
  );
}
