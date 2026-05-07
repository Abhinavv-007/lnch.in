/**
 * Public per-project page. Reachable as `/projects/:slug`. Renders without
 * auth — every datum here is something we explicitly publish.
 *
 * The page is composed entirely of poster cards (scalloped edges, dotted
 * paper grid, mono eyebrows, serif italic accents) so it sits in the same
 * editorial system as the landing page.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Github, Activity } from "lucide-react";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import LatencyStrip from "@/components/public/LatencyStrip";

type Snippet = { language: "shell" | "js" | "python"; label: string; code: string };

type ProjectDetail = {
  slug: string;
  name: string;
  repo: string;
  site: string | null;
  blurb: string;
  accent: string;
  generatedAt: number;
  health: {
    targets: string[];
    snapshots: { target: string; ok: boolean; status: number | null; latencyMs: number | null; ts: number }[];
    last24h: {
      total: number;
      ok: number;
      p50LatencyMs: number | null;
      p95LatencyMs: number | null;
      p99LatencyMs: number | null;
    };
  };
  github: {
    configured: boolean;
    note?: string;
    recentCommits: { sha: string; message: string; author: string; ts: number }[];
    openPRs: number | null;
    openIssues: number | null;
  };
  snippets: Snippet[];
};

function timeAgo(ts: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function PublicProject() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSnippet, setActiveSnippet] = useState<Snippet["language"]>("shell");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/public/projects/${slug}`, { credentials: "omit" });
        if (!r.ok) {
          setError(r.status === 404 ? "Project not found" : "Couldn't load project");
          return;
        }
        const body = (await r.json()) as ProjectDetail;
        if (!cancelled) setDetail(body);
      } catch {
        if (!cancelled) setError("Network error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <main className="bg-paper-grid min-h-screen">
        <PublicHeader />
        <section className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="poster-eyebrow justify-center">404</p>
          <h1 className="poster-headline poster-headline--md mt-3 justify-center">{error}</h1>
          <Link to="/" className="poster-button mt-6">
            <ArrowLeft className="h-3.5 w-3.5" /> back to lnch.in
          </Link>
        </section>
        <PublicFooter />
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="bg-paper-grid min-h-screen">
        <PublicHeader />
        <section className="mx-auto max-w-5xl px-6 py-24">
          <div className="poster-card poster-card--sm">
            <div className="h-12 w-1/3 rounded shimmer" />
            <div className="mt-4 h-4 w-2/3 rounded shimmer" />
            <div className="mt-2 h-4 w-1/2 rounded shimmer" />
          </div>
        </section>
        <PublicFooter />
      </main>
    );
  }

  const okPct =
    detail.health.last24h.total > 0
      ? Number(((detail.health.last24h.ok / detail.health.last24h.total) * 100).toFixed(2))
      : null;

  const points = detail.health.snapshots
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 80)
    .map((s) => ({ ts: s.ts, latencyMs: s.latencyMs, ok: s.ok }));

  const snippet = detail.snippets.find((s) => s.language === activeSnippet) ?? detail.snippets[0];

  return (
    <main className="bg-paper-grid min-h-screen">
      <PublicHeader />

      <section className="mx-auto max-w-5xl px-6 pt-12 pb-6">
        <Link to="/" className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.28em] text-fg-soft hover:text-accent">
          <ArrowLeft className="h-3 w-3" /> all projects
        </Link>

        <div className="poster-card poster-live mt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="poster-eyebrow" style={{ color: detail.accent }}>
                {detail.slug}
              </p>
              <h1 className="poster-headline mt-3">
                <span className="accent">{detail.name}</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-fg-soft">{detail.blurb}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {detail.site && (
                <a href={detail.site} target="_blank" rel="noreferrer" className="poster-stamp">
                  {new URL(detail.site).host}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
              <a
                href={`https://github.com/${detail.repo}`}
                target="_blank"
                rel="noreferrer"
                className="poster-stamp"
              >
                <Github className="h-3 w-3" /> {detail.repo}
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <PosterStat
              label="Uptime · 24h"
              value={okPct != null ? `${okPct.toFixed(2)}%` : "—"}
              hint="from health probes"
            />
            <PosterStat
              label="Probes · 24h"
              value={`${detail.health.last24h.ok}/${detail.health.last24h.total}`}
              hint="ok / total"
            />
            <PosterStat
              label="p95 latency · 24h"
              value={detail.health.last24h.p95LatencyMs != null ? `${detail.health.last24h.p95LatencyMs}ms` : "—"}
              hint={detail.health.last24h.p99LatencyMs != null ? `p99 ${detail.health.last24h.p99LatencyMs}ms` : ""}
            />
            <PosterStat
              label="Last probe"
              value={detail.health.snapshots[0] ? `${timeAgo(detail.health.snapshots[0].ts)} ago` : "—"}
              hint={detail.health.snapshots[0]?.target.replace(/^https?:\/\//, "") ?? ""}
            />
          </div>

          <div className="poster-footer-strip">
            <span className="poster-footer-strip__brand">
              <span className="poster-bullet" />
              LNCH.IN
            </span>
            <span>{detail.slug} · last 24h</span>
          </div>
        </div>
      </section>

      {/* Latency graph */}
      <section className="mx-auto max-w-5xl px-6 pb-10">
        <div className="poster-card poster-card--sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="poster-eyebrow">latency over the last 24 hours</p>
            <p className="hidden text-xs uppercase tracking-[0.28em] text-muted md:block">{points.length} probes</p>
          </div>
          <LatencyStrip points={points} height={56} />
        </div>
      </section>

      {/* API snippet */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="poster-card poster-card--sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              <p className="poster-eyebrow">how to call our API</p>
            </div>
            <div className="flex flex-wrap gap-1 text-xs">
              {detail.snippets.map((s) => (
                <button
                  key={s.language}
                  onClick={() => setActiveSnippet(s.language)}
                  className={
                    s.language === activeSnippet
                      ? "poster-stamp poster-stamp--filled text-fg"
                      : "poster-stamp"
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <pre className="terminal mt-4 overflow-x-auto rounded-xl px-5 py-4 text-sm">
            <code>{snippet?.code ?? ""}</code>
          </pre>
        </div>
      </section>

      {/* Targets */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="poster-card poster-card--sm">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="poster-headline poster-headline--sm">
              <span className="accent">Endpoints</span>
              <span className="text-fg">we probe</span>
            </h2>
            <p className="text-xs uppercase tracking-[0.28em] text-muted">{detail.health.targets.length}</p>
          </div>
          <div className="poster-row-table-head">
            <span>endpoint</span>
            <span></span>
            <span className="poster-row__hide-sm">latency</span>
            <span>status</span>
          </div>
          <ul>
            {detail.health.targets.length === 0 && (
              <li className="poster-row text-sm text-fg-soft">no probes configured yet</li>
            )}
            {detail.health.targets.map((target) => {
              const latest = detail.health.snapshots.find((s) => s.target === target);
              const stamp =
                latest === undefined
                  ? "poster-stamp"
                  : latest.ok
                    ? "poster-stamp poster-stamp--ok"
                    : "poster-stamp poster-stamp--err";
              return (
                <li key={target} className="poster-row">
                  <span aria-hidden className="poster-bullet text-accent" />
                  <a
                    href={target}
                    target="_blank"
                    rel="noreferrer"
                    className="poster-row__label hover:text-accent"
                  >
                    {target}
                  </a>
                  <span className="poster-row__detail poster-row__hide-sm">
                    {latest?.latencyMs != null ? `${latest.latencyMs}ms` : "—"}
                  </span>
                  <span className={stamp}>
                    {latest === undefined ? "no data" : latest.ok ? "ok" : "down"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* GitHub */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="poster-card poster-card--sm">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="poster-headline poster-headline--sm">
              Recent <span className="accent">commits</span>
            </h2>
            {(detail.github.openPRs != null || detail.github.openIssues != null) && (
              <div className="hidden flex-wrap gap-2 text-xs md:flex">
                <span className="poster-stamp">{detail.github.openPRs ?? 0} open PRs</span>
                <span className="poster-stamp">{detail.github.openIssues ?? 0} open issues</span>
              </div>
            )}
          </div>
          {detail.github.recentCommits.length === 0 ? (
            <p className="text-sm text-fg-soft">{detail.github.note ?? "No commit data available."}</p>
          ) : (
            <ul>
              {detail.github.recentCommits.map((c) => (
                <li key={c.sha} className="poster-row">
                  <span className="poster-row__label font-mono text-xs text-accent">{c.sha}</span>
                  <a
                    href={`https://github.com/${detail.repo}/commit/${c.sha}`}
                    target="_blank"
                    rel="noreferrer"
                    className="poster-row__label flex-1 hover:text-accent"
                  >
                    {c.message}
                  </a>
                  <span className="poster-row__detail poster-row__hide-sm">{c.author}</span>
                  <span className="poster-row__detail">{timeAgo(c.ts)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function PosterStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="poster-stat poster-stat--block">
      <p className="poster-stat__label">{label}</p>
      <p className="poster-stat__value">{value}</p>
      {hint ? <p className="poster-stat__hint">{hint}</p> : null}
    </div>
  );
}
