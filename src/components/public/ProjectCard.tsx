import { Link } from "react-router-dom";
import { ArrowUpRight, Github } from "lucide-react";

type ProjectSummary = {
  slug: string;
  name: string;
  repo: string;
  site: string | null;
  blurb: string;
  accent: string;
  health: { state: "ok" | "warn" | "err" | "unknown"; ok: number; targets: number };
  latestProbe: { latencyMs: number | null; status: number | null; ts: number } | null;
  last24h: { probes: number; ok: number; p95LatencyMs: number | null };
};

const STATE_PILL: Record<ProjectSummary["health"]["state"], string> = {
  ok: "paper-pill paper-pill-ok",
  warn: "paper-pill paper-pill-warn",
  err: "paper-pill paper-pill-err",
  unknown: "paper-pill",
};

const STATE_TEXT: Record<ProjectSummary["health"]["state"], string> = {
  ok: "online",
  warn: "degraded",
  err: "down",
  unknown: "no data",
};

function uptimePct(p: ProjectSummary): number | null {
  if (p.last24h.probes === 0) return null;
  return Number(((p.last24h.ok / p.last24h.probes) * 100).toFixed(2));
}

export default function ProjectCard({ project: p }: { project: ProjectSummary }) {
  const uptime = uptimePct(p);
  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-rule bg-paper-elev p-5 transition hover:border-accent"
      style={{ ["--accent" as string]: p.accent }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)`,
        }}
      />
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="cursive-accent text-2xl text-fg" style={{ color: p.accent }}>
            {p.name}
          </h3>
          <p className="mt-1.5 max-w-[40ch] text-sm leading-relaxed text-fg-soft">
            {p.blurb}
          </p>
        </div>
        <span className={STATE_PILL[p.health.state]}>{STATE_TEXT[p.health.state]}</span>
      </header>

      <dl className="mt-5 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-muted">Latency</dt>
          <dd className="mt-0.5 font-mono text-fg">
            {p.latestProbe?.latencyMs != null
              ? `${p.latestProbe.latencyMs}ms`
              : p.last24h.p95LatencyMs != null
                ? `${p.last24h.p95LatencyMs}ms`
                : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Uptime 24h</dt>
          <dd className="mt-0.5 font-mono text-fg">
            {uptime != null ? `${uptime.toFixed(2)}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Probes</dt>
          <dd className="mt-0.5 font-mono text-fg">
            {p.health.ok}/{p.health.targets}
          </dd>
        </div>
      </dl>

      <div className="mt-5 rounded-lg border border-rule-soft bg-paper-soft p-2.5 font-mono text-[11px] leading-relaxed text-fg-soft">
        <span className="text-accent">$</span> curl -s {p.site ?? "https://"+p.slug+".lnch.in"}
        /api/health
      </div>

      <footer className="mt-5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-fg-soft">
          {p.site && (
            <a
              href={p.site}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-accent"
            >
              {new URL(p.site).host}
              <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
          <a
            href={`https://github.com/${p.repo}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-accent"
          >
            <Github className="h-3 w-3" />
            source
          </a>
        </div>
        <Link
          to={`/projects/${p.slug}`}
          className="inline-flex items-center gap-1 rounded-full border border-rule bg-paper-soft px-3 py-1 text-xs text-fg transition hover:border-accent"
        >
          Open project
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </footer>
    </article>
  );
}

export type { ProjectSummary };
