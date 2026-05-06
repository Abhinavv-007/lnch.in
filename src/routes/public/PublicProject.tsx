/**
 * Public per-project page. Reachable as `/projects/:slug`. Renders without
 * auth — every datum here is something we explicitly publish.
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
      <main className="bg-stage min-h-screen">
        <PublicHeader />
        <section className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-accent">404</p>
          <h1 className="font-serif mt-3 text-3xl text-fg">{error}</h1>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-fg-soft hover:text-accent">
            <ArrowLeft className="h-4 w-4" /> back to lnch.in
          </Link>
        </section>
        <PublicFooter />
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="bg-stage min-h-screen">
        <PublicHeader />
        <section className="mx-auto max-w-5xl px-6 py-24">
          <div className="paper-panel-soft h-12 w-1/3 animate-pulse" />
          <div className="paper-panel-soft mt-4 h-4 w-2/3 animate-pulse" />
          <div className="paper-panel-soft mt-2 h-4 w-1/2 animate-pulse" />
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
    <main className="bg-stage min-h-screen">
      <PublicHeader />

      <section className="mx-auto max-w-5xl px-6 pt-12 pb-6">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-fg-soft hover:text-accent">
          <ArrowLeft className="h-3 w-3" /> all projects
        </Link>
        <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em]" style={{ color: detail.accent }}>
              {detail.slug}
            </p>
            <h1
              className="font-serif mt-2 text-5xl tracking-tight md:text-6xl"
              style={{ color: detail.accent }}
            >
              <span className="cursive-accent">{detail.name}</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-fg-soft">{detail.blurb}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {detail.site && (
              <a
                href={detail.site}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-rule bg-paper-elev px-3 py-1 text-fg hover:border-accent"
              >
                {new URL(detail.site).host}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
            <a
              href={`https://github.com/${detail.repo}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-rule bg-paper-elev px-3 py-1 text-fg hover:border-accent"
            >
              <Github className="h-3 w-3" /> {detail.repo}
            </a>
          </div>
        </header>
      </section>

      {/* Live stats */}
      <section className="mx-auto max-w-5xl px-6 pb-8">
        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="Uptime · 24h" value={okPct != null ? `${okPct.toFixed(2)}%` : "—"} hint="from health probes" />
          <Stat label="Probes · 24h" value={`${detail.health.last24h.ok}/${detail.health.last24h.total}`} hint="ok / total" />
          <Stat
            label="p95 latency · 24h"
            value={detail.health.last24h.p95LatencyMs != null ? `${detail.health.last24h.p95LatencyMs}ms` : "—"}
            hint={detail.health.last24h.p99LatencyMs != null ? `p99 ${detail.health.last24h.p99LatencyMs}ms` : ""}
          />
          <Stat
            label="Last probe"
            value={detail.health.snapshots[0] ? `${timeAgo(detail.health.snapshots[0].ts)} ago` : "—"}
            hint={detail.health.snapshots[0]?.target.replace(/^https?:\/\//, "") ?? ""}
          />
        </div>
      </section>

      {/* Latency graph */}
      <section className="mx-auto max-w-5xl px-6 pb-10">
        <div className="paper-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-accent">latency over the last 24 hours</p>
            <p className="hidden text-xs text-muted md:block">{points.length} probes</p>
          </div>
          <LatencyStrip points={points} height={56} />
        </div>
      </section>

      {/* API snippet */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="paper-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              <p className="text-xs uppercase tracking-[0.3em] text-accent">how to call our API</p>
            </div>
            <div className="flex gap-1 text-xs">
              {detail.snippets.map((s) => (
                <button
                  key={s.language}
                  onClick={() => setActiveSnippet(s.language)}
                  className={
                    "rounded-full px-3 py-1 transition " +
                    (s.language === activeSnippet
                      ? "bg-accent text-paper"
                      : "border border-rule bg-paper-elev text-fg-soft hover:text-fg")
                  }
                  style={s.language === activeSnippet ? { color: "var(--bg)" } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <pre className="terminal m-0 overflow-x-auto rounded-none border-0 px-5 py-4 text-sm">
            <code>{snippet?.code ?? ""}</code>
          </pre>
        </div>
      </section>

      {/* Targets */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <h2 className="font-serif mb-4 text-2xl text-fg">
          <span className="cursive-accent text-accent">Endpoints</span> we probe
        </h2>
        <ul className="paper-panel divide-y divide-rule">
          {detail.health.targets.length === 0 && (
            <li className="px-5 py-4 text-sm text-fg-soft">no probes configured yet</li>
          )}
          {detail.health.targets.map((target) => {
            const latest = detail.health.snapshots.find((s) => s.target === target);
            const tone =
              latest === undefined
                ? "paper-pill"
                : latest.ok
                  ? "paper-pill paper-pill-ok"
                  : "paper-pill paper-pill-err";
            return (
              <li key={target} className="flex items-center justify-between gap-3 px-5 py-3">
                <a
                  href={target}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-mono text-xs text-fg hover:text-accent"
                >
                  {target}
                </a>
                <div className="flex items-center gap-3 text-xs text-fg-soft">
                  <span>{latest?.latencyMs != null ? `${latest.latencyMs}ms` : "—"}</span>
                  <span>{latest?.status ?? "—"}</span>
                  <span className={tone}>{latest === undefined ? "no data" : latest.ok ? "ok" : "down"}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* GitHub */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="font-serif mb-4 text-2xl text-fg">
          Recent <span className="cursive-accent text-accent">commits</span>
        </h2>
        {detail.github.recentCommits.length === 0 ? (
          <div className="paper-panel-soft p-5 text-sm text-fg-soft">
            {detail.github.note ?? "No commit data available."}
          </div>
        ) : (
          <ul className="paper-panel divide-y divide-rule">
            {detail.github.recentCommits.map((c) => (
              <li key={c.sha}>
                <a
                  href={`https://github.com/${detail.repo}/commit/${c.sha}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 px-5 py-3 text-sm hover:bg-paper-soft"
                >
                  <span className="font-mono text-xs text-accent">{c.sha}</span>
                  <span className="flex-1 truncate text-fg">{c.message}</span>
                  <span className="text-xs text-muted">{c.author} · {timeAgo(c.ts)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {(detail.github.openPRs != null || detail.github.openIssues != null) && (
          <div className="mt-4 flex gap-2 text-xs">
            <span className="paper-pill">{detail.github.openPRs ?? 0} open PRs</span>
            <span className="paper-pill">{detail.github.openIssues ?? 0} open issues</span>
          </div>
        )}
      </section>

      <PublicFooter />
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="paper-panel-soft p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-1.5 font-mono text-xl text-fg">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
