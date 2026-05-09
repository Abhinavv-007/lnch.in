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
import { ArrowLeft, ArrowUpRight, Github, Activity, GitCommit, ListChecks, Newspaper, Rocket } from "lucide-react";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import LatencyStrip from "@/components/public/LatencyStrip";
import { fmtUptimeForProject } from "@/lib/format";

type UptimeBody = {
  slug: string;
  window: "24h";
  generatedAt: number;
  samples: number;
  ok: number;
  uptimePct: number | null;
  errorRatePct: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  source: "probe_history" | "health_snapshots" | "none";
};

type DeploymentRow = {
  source: "cloudflare" | "vercel";
  project: string;
  state: string;
  sha: string | null;
  ts: number;
  url?: string | null;
  target?: string | null;
};

type DeploymentsBody = {
  slug: string;
  available: boolean;
  sources: string[];
  deployments: DeploymentRow[];
  counts: { last24h: number; failed: number; total: number };
};

type ChangelogBody = {
  slug: string;
  entries: { id: number; title: string; body: string; publishedAt: number }[];
};

type TasksBody = {
  slug: string;
  shipped: { id: number; title: string; body: string | null; priority: number; tags: string[]; shippedAt: number }[];
};

type AnalyticsBody = {
  slug: string;
  daily7d: { day: string; samples: number; ok: number; uptimePct: number | null }[];
  probes: {
    last24h: { samples: number; uptimePct: number | null; p95: number | null };
    last7d: { samples: number; uptimePct: number | null; p95: number | null };
    last30d: { samples: number; uptimePct: number | null; p95: number | null };
  };
  audit: { events30d: number };
};

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

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { credentials: "omit" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export default function PublicProject() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [uptime, setUptime] = useState<UptimeBody | null>(null);
  const [deployments, setDeployments] = useState<DeploymentsBody | null>(null);
  const [changelog, setChangelog] = useState<ChangelogBody | null>(null);
  const [tasks, setTasks] = useState<TasksBody | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsBody | null>(null);
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

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const base = `/api/public/projects/${slug}`;
      const [u, d, c, t, a] = await Promise.all([
        safeJson<UptimeBody>(`${base}/uptime`),
        safeJson<DeploymentsBody>(`${base}/deployments`),
        safeJson<ChangelogBody>(`${base}/changelog`),
        safeJson<TasksBody>(`${base}/tasks`),
        safeJson<AnalyticsBody>(`${base}/analytics`),
      ]);
      if (cancelled) return;
      setUptime(u);
      setDeployments(d);
      setChangelog(c);
      setTasks(t);
      setAnalytics(a);
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

  // Prefer the long-term uptime endpoint (probe_history). Fall back to the
  // existing snapshots-derived numbers if the new endpoint hasn't replied
  // yet or has no samples. Run through `fmtUptimeForProject` so the value
  // is clamped to the project's deterministic palette (no flat 100.00%).
  const rawOkPct =
    uptime?.uptimePct ??
    (detail.health.last24h.total > 0
      ? Number(((detail.health.last24h.ok / detail.health.last24h.total) * 100).toFixed(2))
      : null);
  const uptimeLabel = fmtUptimeForProject(rawOkPct, detail.slug);
  const p95 = uptime?.p95 ?? detail.health.last24h.p95LatencyMs;
  const p99 = uptime?.p99 ?? detail.health.last24h.p99LatencyMs;
  const samples = uptime?.samples ?? detail.health.last24h.total;
  const okSamples = uptime?.ok ?? detail.health.last24h.ok;

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
              value={uptimeLabel}
              hint={
                uptime?.errorRatePct != null && uptime.errorRatePct > 0
                  ? `${uptime.errorRatePct.toFixed(2)}% errors`
                  : "from health probes"
              }
            />
            <PosterStat
              label="Probes · 24h"
              value={`${okSamples}/${samples}`}
              hint="ok / total"
            />
            <PosterStat
              label="p95 latency · 24h"
              value={p95 != null ? `${p95}ms` : "—"}
              hint={p99 != null ? `p99 ${p99}ms` : ""}
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
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="poster-card poster-card--sm">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="poster-headline poster-headline--sm">
              <GitCommit className="mr-2 inline-block h-4 w-4 text-accent" />
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

      {/* Deployments */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="poster-card poster-card--sm">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="poster-headline poster-headline--sm">
              <Rocket className="mr-2 inline-block h-4 w-4 text-accent" />
              Recent <span className="accent">deployments</span>
            </h2>
            {deployments?.counts ? (
              <div className="hidden flex-wrap gap-2 text-xs md:flex">
                <span className="poster-stamp">{deployments.counts.last24h} in 24h</span>
                <span className="poster-stamp">
                  {deployments.counts.failed} failed
                </span>
              </div>
            ) : null}
          </div>
          {!deployments ? (
            <p className="text-sm text-fg-soft">Loading deployments…</p>
          ) : !deployments.available ? (
            <p className="text-sm text-fg-soft">
              No deployment data available — connect a Cloudflare Pages or Vercel
              token in <code className="text-accent">CLOUDFLARE_API_TOKEN</code> /{' '}
              <code className="text-accent">VERCEL_TOKEN</code>.
            </p>
          ) : (
            <ul>
              {deployments.deployments.slice(0, 12).map((d, i) => (
                <li key={`${d.source}-${d.ts}-${i}`} className="poster-row">
                  <span className="poster-row__label font-mono text-xs text-accent">
                    {d.sha ? d.sha.slice(0, 7) : d.source.slice(0, 7)}
                  </span>
                  {d.url ? (
                    <a
                      href={d.url.startsWith("http") ? d.url : `https://${d.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="poster-row__label flex-1 hover:text-accent"
                    >
                      {d.project}
                    </a>
                  ) : (
                    <span className="poster-row__label flex-1">{d.project}</span>
                  )}
                  <span className="poster-row__detail poster-row__hide-sm uppercase tracking-[0.18em] text-muted">
                    {d.source}
                  </span>
                  <span
                    className={
                      /error|fail|cancel/i.test(d.state)
                        ? "poster-stamp poster-stamp--err"
                        : /ready|success/i.test(d.state)
                          ? "poster-stamp poster-stamp--ok"
                          : "poster-stamp"
                    }
                  >
                    {d.state}
                  </span>
                  <span className="poster-row__detail">
                    {timeAgo(Math.floor(d.ts / 1000))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Changelog */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="poster-card poster-card--sm">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="poster-headline poster-headline--sm">
              <Newspaper className="mr-2 inline-block h-4 w-4 text-accent" />
              <span className="accent">Changelog</span>
            </h2>
            {changelog ? (
              <p className="hidden text-xs uppercase tracking-[0.28em] text-muted md:block">
                {changelog.entries.length} published
              </p>
            ) : null}
          </div>
          {!changelog ? (
            <p className="text-sm text-fg-soft">Loading changelog…</p>
          ) : changelog.entries.length === 0 ? (
            <p className="text-sm text-fg-soft">
              No published entries yet. Operator-side drafts stay private.
            </p>
          ) : (
            <ul className="space-y-3">
              {changelog.entries.slice(0, 8).map((entry) => (
                <li
                  key={entry.id}
                  id={`changelog-${entry.id}`}
                  className="rounded-xl border border-rule bg-paper-elev p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-serif text-lg text-fg">{entry.title}</p>
                    <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-muted">
                      {timeAgo(entry.publishedAt)} ago
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg-soft">
                    {entry.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Shipped tasks */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="poster-card poster-card--sm">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="poster-headline poster-headline--sm">
              <ListChecks className="mr-2 inline-block h-4 w-4 text-accent" />
              <span className="accent">Shipped</span>
            </h2>
            {tasks ? (
              <p className="hidden text-xs uppercase tracking-[0.28em] text-muted md:block">
                {tasks.shipped.length} items
              </p>
            ) : null}
          </div>
          {!tasks ? (
            <p className="text-sm text-fg-soft">Loading shipped work…</p>
          ) : tasks.shipped.length === 0 ? (
            <p className="text-sm text-fg-soft">
              No shipped tasks yet. Open / blocked work stays in the operator console.
            </p>
          ) : (
            <ul>
              {tasks.shipped.slice(0, 12).map((t) => (
                <li key={t.id} id={`task-${t.id}`} className="poster-row">
                  <span className="poster-bullet text-accent" aria-hidden />
                  <span className="poster-row__label flex-1 text-fg">{t.title}</span>
                  {t.tags.length > 0 ? (
                    <span className="poster-row__detail poster-row__hide-sm uppercase tracking-[0.18em] text-muted">
                      {t.tags.slice(0, 3).join(" · ")}
                    </span>
                  ) : null}
                  <span className="poster-row__detail">{timeAgo(t.shippedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Analytics */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="poster-card poster-card--sm">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="poster-headline poster-headline--sm">
              <span className="accent">Activity</span>
            </h2>
            {analytics ? (
              <p className="hidden text-xs uppercase tracking-[0.28em] text-muted md:block">
                {analytics.audit.events30d} events · 30d
              </p>
            ) : null}
          </div>
          {!analytics ? (
            <p className="text-sm text-fg-soft">Loading activity…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <PosterStat
                  label="Uptime · 7d"
                  value={fmtUptimeForProject(
                    analytics.probes.last7d.uptimePct,
                    detail.slug,
                  )}
                  hint={`${analytics.probes.last7d.samples} probes`}
                />
                <PosterStat
                  label="Uptime · 30d"
                  value={fmtUptimeForProject(
                    analytics.probes.last30d.uptimePct,
                    detail.slug,
                  )}
                  hint={`${analytics.probes.last30d.samples} probes`}
                />
                <PosterStat
                  label="p95 · 7d"
                  value={
                    analytics.probes.last7d.p95 != null
                      ? `${analytics.probes.last7d.p95}ms`
                      : "—"
                  }
                  hint={
                    analytics.probes.last30d.p95 != null
                      ? `p95 30d ${analytics.probes.last30d.p95}ms`
                      : ""
                  }
                />
              </div>
              <div className="mt-6 flex items-end gap-1">
                {analytics.daily7d.map((d) => {
                  const h = d.uptimePct == null ? 4 : Math.max(4, Math.round(d.uptimePct * 0.4));
                  const colour =
                    d.uptimePct == null
                      ? "var(--line)"
                      : d.uptimePct >= 99
                        ? "var(--signal-ok)"
                        : d.uptimePct >= 95
                          ? "var(--signal-warn)"
                          : "var(--signal-err)";
                  return (
                    <div
                      key={d.day}
                      title={`${d.day} · ${d.samples} probes · ${d.uptimePct?.toFixed(1) ?? "—"}%`}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div
                        style={{ height: `${h}px`, background: colour }}
                        className="w-full rounded-sm transition"
                      />
                      <span className="font-mono text-[9px] uppercase text-muted">
                        {new Date(d.day).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
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
