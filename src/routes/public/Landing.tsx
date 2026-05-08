/**
 * Public lnch.in launch hub.
 *
 * The landing renders fully static if the public APIs are unreachable; once
 * `/api/public/projects` and `/api/public/commits` resolve we hydrate live
 * status, latency, and the recent-commits ticker.
 *
 * Visually this page is a single editorial poster — every section is a
 * `.poster-card` with scalloped edges, dotted paper grid background, mono
 * eyebrows, serif italic accents, and a footer strip. The reference posters
 * (heatmap, status, flow, uptime) all live inside this same system rather
 * than ad-hoc cards floating on a generic SaaS background.
 */
import { useEffect, useMemo, useState } from "react";
import { Lock, Activity, Github } from "lucide-react";
import { Link } from "react-router-dom";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import StatusTerminal from "@/components/public/StatusTerminal";
import LatencyStrip from "@/components/public/LatencyStrip";
import CommitTicker, { type Commit } from "@/components/public/CommitTicker";
import ProjectCard, { type ProjectSummary } from "@/components/public/ProjectCard";
import HeatmapPoster, { type HeatmapData } from "@/components/public/HeatmapPoster";
import GitHubContribHeatmap, { type ContribData } from "@/components/public/GitHubContribHeatmap";
import { useHashScroll } from "@/lib/useHashScroll";

type ProjectsResponse = {
  generatedAt: number;
  projects: ProjectSummary[];
  counts: { total: number; healthy: number; warning: number; down: number; unknown: number };
};

type ProbesResponse = {
  generatedAt: number;
  probes: {
    project: string;
    target: string;
    total: number;
    ok: number;
    uptimePct: number | null;
    p50: number | null;
    p95: number | null;
    p99: number | null;
    latest: { ok: boolean; latencyMs: number | null; ts: number }[];
  }[];
};

type CommitsResponse = { commits: Commit[]; generatedAt: number };

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { credentials: "omit" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export default function LandingPage() {
  useHashScroll();
  const [projects, setProjects] = useState<ProjectsResponse | null>(null);
  const [probes, setProbes] = useState<ProbesResponse | null>(null);
  const [commits, setCommits] = useState<CommitsResponse | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [contrib, setContrib] = useState<ContribData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, q, c, h, gc] = await Promise.all([
        safeJson<ProjectsResponse>("/api/public/projects"),
        safeJson<ProbesResponse>("/api/public/probes"),
        safeJson<CommitsResponse>("/api/public/commits"),
        safeJson<HeatmapData>("/api/public/heatmap"),
        safeJson<ContribData>("/api/public/github/contributions"),
      ]);
      if (cancelled) return;
      setProjects(p);
      setProbes(q);
      setCommits(c);
      setHeatmap(h);
      setContrib(gc);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const aggregateP95 = useMemo(() => {
    if (!probes?.probes?.length) return null;
    const valid = probes.probes
      .map((p) => p.p95)
      .filter((v): v is number => typeof v === "number");
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
  }, [probes]);

  const allLatencyPoints = useMemo(() => {
    if (!probes?.probes?.length) return [];
    return probes.probes
      .flatMap((p) => p.latest)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 80);
  }, [probes]);

  return (
    <main className="bg-paper-grid min-h-screen">
      <PublicHeader />

      {/* Hero — poster ticket */}
      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-12 md:pt-28 md:pb-16">
        <div className="poster-card poster-live">
          <div className="flex flex-wrap items-center gap-3 mb-7">
            <span className="poster-stamp">
              <span aria-hidden className="poster-bullet" />
              The launch hub · vol. 01
            </span>
            <p className="poster-eyebrow text-fg-soft">
              where projects go live
            </p>
          </div>
          <h1 className="poster-headline">
            Ship the work.
            <span className="accent">Run the rest.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-fg-soft md:text-lg">
            lnch.in is the public face — and the operator console — for every
            product I build. Live status, public APIs, source code, deploy
            history. Everything is open.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#projects" className="poster-button poster-button--primary">
              Browse projects
            </a>
            <Link to="/ops" className="poster-button">
              <Lock className="h-3.5 w-3.5" /> Operator console
            </Link>
            <a href="#api" className="poster-button">
              <Activity className="h-3.5 w-3.5" /> Public API
            </a>
          </div>
          <div className="poster-footer-strip mt-10">
            <span className="poster-footer-strip__brand">
              <span className="poster-bullet" />
              LNCH.IN
            </span>
            <span>est. 2025</span>
            <span>edition · live</span>
          </div>
        </div>
      </section>

      {/* Live status terminal */}
      <section id="status" className="mx-auto max-w-6xl px-6 pb-10">
        <PosterHeading
          eyebrow="live"
          headline={
            <>
              <span className="accent">Status</span>
              <span>—</span>
              every project, right now
            </>
          }
          aside={
            <>
              data via <code className="text-accent">/api/public/projects</code>
            </>
          }
        />
        <StatusTerminal projects={projects?.projects ?? null} />
      </section>

      {/* Latency strip — uptime poster */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="poster-card poster-card--sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="poster-eyebrow">latency · last 24h</p>
              <p className="mt-2 font-serif text-3xl text-fg">
                {aggregateP95 != null ? `${aggregateP95}ms` : "—"}{" "}
                <span className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
                  avg p95 across {probes?.probes?.length ?? 0} probes
                </span>
              </p>
            </div>
            <p className="hidden text-xs uppercase tracking-[0.28em] text-muted md:block">
              every red tick is a failed probe in the last 24h
            </p>
          </div>
          <div className="mt-5">
            <LatencyStrip points={allLatencyPoints} />
          </div>
          <div className="poster-footer-strip">
            <span className="poster-footer-strip__brand">
              <span className="poster-bullet" />
              LNCH.IN
            </span>
            <span>last 24 hours</span>
          </div>
        </div>
      </section>

      {/* Heatmap — API events by day × hour, real D1-sourced */}
      <section id="heatmap" className="mx-auto max-w-6xl px-6 pb-14">
        <HeatmapPoster data={heatmap} />
      </section>

      {/* GitHub contribution heatmap (53 weeks × 7 days) */}
      <section id="github" className="mx-auto max-w-6xl px-6 pb-14">
        <GitHubContribHeatmap
          data={contrib}
          profileUrl={`https://github.com/${contrib?.login ?? "Abhinavv-007"}`}
        />
      </section>

      {/* Projects */}
      <section id="projects" className="mx-auto max-w-6xl px-6 pb-16">
        <PosterHeading
          eyebrow="the launch slate"
          headline={
            <>
              Projects in <span className="accent">flight</span>
            </>
          }
          aside={
            <>
              {projects?.counts.total ?? 0} active · {projects?.counts.healthy ?? 0} healthy
            </>
          }
        />
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(projects?.projects ?? PLACEHOLDER_PROJECTS).map((p) => (
            <li key={p.slug}>
              <ProjectCard project={p} />
            </li>
          ))}
        </ul>
      </section>

      {/* Commit ticker */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <PosterHeading
          eyebrow="commit feed"
          headline={
            <>
              What's <span className="accent">shipping</span> right now
            </>
          }
          aside={
            <a
              href="https://github.com/Abhinavv-007"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-accent"
            >
              <Github className="h-3 w-3" /> all repos
            </a>
          }
        />
        <CommitTicker commits={commits?.commits ?? null} />
      </section>

      {/* Public API banner */}
      <section id="api" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="poster-card overflow-hidden">
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            <div>
              <p className="poster-eyebrow">public API</p>
              <h2 className="poster-headline poster-headline--md mt-2">
                Run it from your <span className="accent">terminal</span>
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-fg-soft">
                Every project exposes a <code className="text-accent">/api/health</code> and{" "}
                <code className="text-accent">/api/public/summary</code> endpoint. No auth, JSON,
                cacheable. Hit them from CI, dashboards, or the command line.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="poster-stamp"><code>GET /api/public/projects</code></span>
                <span className="poster-stamp"><code>GET /api/public/projects/:slug</code></span>
                <span className="poster-stamp"><code>GET /api/public/probes</code></span>
                <span className="poster-stamp"><code>GET /api/public/commits</code></span>
              </div>
            </div>
            <div className="md:border-l md:border-rule md:pl-6">
              <pre className="terminal overflow-x-auto rounded-xl p-4">
                <code className="block whitespace-pre">
                  <span className="term-prompt">$</span>{" "}
                  <span className="term-cmd">curl -s https://lnch.in/api/public/projects | jq '.counts'</span>
                  {"\n"}
                  <span className="term-dim">{`{`}</span>
                  {"\n"}
                  {`  `}
                  <span className="term-dim">"total":</span> <span className="term-ok">6</span>,
                  {"\n"}
                  {`  `}
                  <span className="term-dim">"healthy":</span> <span className="term-ok">{projects?.counts.healthy ?? "—"}</span>,
                  {"\n"}
                  {`  `}
                  <span className="term-dim">"warning":</span> <span className="term-warn">{projects?.counts.warning ?? "—"}</span>,
                  {"\n"}
                  {`  `}
                  <span className="term-dim">"down":</span> <span className="term-err">{projects?.counts.down ?? "—"}</span>
                  {"\n"}
                  <span className="term-dim">{`}`}</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

/**
 * Section heading rendered in the poster style — eyebrow + serif italic
 * headline + optional right-aligned aside.
 */
function PosterHeading({
  eyebrow,
  headline,
  aside,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="poster-eyebrow">{eyebrow}</p>
        <h2 className="poster-headline poster-headline--md mt-2">{headline}</h2>
      </div>
      {aside ? (
        <p className="hidden text-xs uppercase tracking-[0.28em] text-muted md:block">{aside}</p>
      ) : null}
    </div>
  );
}

const PLACEHOLDER_PROJECTS: ProjectSummary[] = [
  {
    slug: "modih",
    name: "Modih Mail",
    repo: "Abhinavv-007/modih-email",
    site: "https://modih.in",
    blurb: "Disposable email at @modih.in. Cloudflare Pages + Functions + D1 + KV with a developer API.",
    accent: "#fb923c",
    health: { state: "unknown", ok: 0, targets: 0 },
    latestProbe: null,
    last24h: { probes: 0, ok: 0, p95LatencyMs: null },
  },
  {
    slug: "clex",
    name: "Clex",
    repo: "Abhinavv-007/clex",
    site: "https://clex.in",
    blurb: "Privacy-first WebRTC file transfer. Workspace, Vault, Chain, signaling, transfer rooms.",
    accent: "#34d399",
    health: { state: "unknown", ok: 0, targets: 0 },
    latestProbe: null,
    last24h: { probes: 0, ok: 0, p95LatencyMs: null },
  },
  {
    slug: "clex-ai",
    name: "Clex AI",
    repo: "Abhinavv-007/clex-ai",
    site: "https://ai.clex.in",
    blurb: "OpenAI-compatible AI gateway. 130+ models, smart routing, streaming, per-key analytics.",
    accent: "#facc15",
    health: { state: "unknown", ok: 0, targets: 0 },
    latestProbe: null,
    last24h: { probes: 0, ok: 0, p95LatencyMs: null },
  },
  {
    slug: "driped",
    name: "Driped",
    repo: "Abhinavv-007/DRIPED-Web",
    site: "https://driped.in",
    blurb: "Subscription tracker. Gmail scan, deterministic parser, AI fallback, savings analytics.",
    accent: "#7c3aed",
    health: { state: "unknown", ok: 0, targets: 0 },
    latestProbe: null,
    last24h: { probes: 0, ok: 0, p95LatencyMs: null },
  },
  {
    slug: "trgt",
    name: "TRGT",
    repo: "Abhinavv-007/f1",
    site: "https://trgt.in",
    blurb: "F1-grade visual experience. Live telemetry, prediction league, race intelligence.",
    accent: "#f87171",
    health: { state: "unknown", ok: 0, targets: 0 },
    latestProbe: null,
    last24h: { probes: 0, ok: 0, p95LatencyMs: null },
  },
  {
    slug: "portfolio",
    name: "Portfolio",
    repo: "Abhinavv-007/Portfolio",
    site: "https://abhnv.in",
    blurb: "abhnv.in — case studies, research, and the projects behind the launches.",
    accent: "#a78bfa",
    health: { state: "unknown", ok: 0, targets: 0 },
    latestProbe: null,
    last24h: { probes: 0, ok: 0, p95LatencyMs: null },
  },
];
