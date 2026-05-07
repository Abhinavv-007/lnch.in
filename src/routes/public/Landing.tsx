/**
 * Public lnch.in launch hub.
 *
 * The landing renders fully static if the public APIs are unreachable; once
 * `/api/public/projects` and `/api/public/commits` resolve we hydrate live
 * status, latency, and the recent-commits ticker.
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
  const [projects, setProjects] = useState<ProjectsResponse | null>(null);
  const [probes, setProbes] = useState<ProbesResponse | null>(null);
  const [commits, setCommits] = useState<CommitsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, q, c] = await Promise.all([
        safeJson<ProjectsResponse>("/api/public/projects"),
        safeJson<ProbesResponse>("/api/public/probes"),
        safeJson<CommitsResponse>("/api/public/commits"),
      ]);
      if (cancelled) return;
      setProjects(p);
      setProbes(q);
      setCommits(c);
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
      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="poster-card">
          <div className="flex flex-wrap items-center gap-3 mb-7">
            <span className="poster-stamp">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              The launch hub · vol. 01
            </span>
            <p className="text-[0.7rem] uppercase tracking-[0.32em] text-fg-soft font-mono">
              where projects go live
            </p>
          </div>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-fg md:text-7xl lg:text-8xl">
            Ship the work.
            <br />
            <span className="cursive-accent text-accent">Run the rest.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-fg-soft md:text-lg">
            lnch.in is the public face — and the operator console — for every
            product I build. Live status, public APIs, source code, deploy
            history. Everything is open.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#projects"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-paper transition hover:opacity-90"
              style={{ color: "var(--bg)" }}
            >
              Browse projects
            </a>
            <Link
              to="/ops"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-rule bg-paper-elev px-5 py-2.5 text-sm font-medium text-fg transition hover:border-accent"
            >
              <Lock className="h-4 w-4" /> Operator console
            </Link>
            <a
              href="#api"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-rule bg-paper-elev px-5 py-2.5 text-sm font-medium text-fg transition hover:border-accent"
            >
              <Activity className="h-4 w-4" /> Public API
            </a>
          </div>
          <div className="mt-10 poster-divider">
            <span>est. 2025</span>
            <span>edition · live</span>
          </div>
        </div>
      </section>

      {/* Live status terminal */}
      <section id="status" className="mx-auto max-w-6xl px-6 pb-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">live</p>
            <h2 className="font-serif mt-1.5 text-2xl tracking-tight text-fg md:text-3xl">
              <span className="cursive-accent text-accent">Status</span> — every project, right now
            </h2>
          </div>
          <p className="hidden text-xs text-fg-soft md:block">
            data via <code className="text-accent">/api/public/projects</code>
          </p>
        </div>
        <StatusTerminal projects={projects?.projects ?? null} />
      </section>

      {/* Latency strip */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="paper-panel p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-accent">latency · last 24h</p>
              <p className="mt-1.5 font-mono text-xl text-fg">
                {aggregateP95 != null ? `${aggregateP95}ms` : "—"}{" "}
                <span className="text-xs text-muted">avg p95 across {probes?.probes?.length ?? 0} probes</span>
              </p>
            </div>
            <p className="hidden text-xs text-fg-soft md:block">
              every red tick is a failed probe in the last 24h
            </p>
          </div>
          <div className="mt-4">
            <LatencyStrip points={allLatencyPoints} />
          </div>
        </div>
      </section>

      {/* Projects */}
      <section id="projects" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">the launch slate</p>
            <h2 className="font-serif mt-1.5 text-3xl tracking-tight text-fg md:text-4xl">
              Projects in <span className="cursive-accent text-accent">flight</span>
            </h2>
          </div>
          <span className="hidden text-xs text-fg-soft md:inline">
            {projects?.counts.total ?? 0} active · {projects?.counts.healthy ?? 0} healthy
          </span>
        </div>
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
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">commit feed</p>
            <h2 className="font-serif mt-1.5 text-2xl tracking-tight text-fg">
              What's <span className="cursive-accent text-accent">shipping</span> right now
            </h2>
          </div>
          <a
            href="https://github.com/Abhinavv-007"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 text-xs text-fg-soft hover:text-accent md:inline-flex"
          >
            <Github className="h-3 w-3" /> all repos
          </a>
        </div>
        <CommitTicker commits={commits?.commits ?? null} />
      </section>

      {/* Public API banner */}
      <section id="api" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="paper-panel overflow-hidden">
          <div className="grid gap-0 md:grid-cols-2">
            <div className="p-6 md:p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-accent">public API</p>
              <h2 className="font-serif mt-2 text-3xl tracking-tight text-fg md:text-4xl">
                Run it from your <span className="cursive-accent text-accent">terminal</span>
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-fg-soft">
                Every project exposes a <code className="text-accent">/api/health</code> and{" "}
                <code className="text-accent">/api/public/summary</code> endpoint. No auth, JSON,
                cacheable. Hit them from CI, dashboards, or the command line.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="paper-pill"><code>GET /api/public/projects</code></span>
                <span className="paper-pill"><code>GET /api/public/projects/:slug</code></span>
                <span className="paper-pill"><code>GET /api/public/probes</code></span>
                <span className="paper-pill"><code>GET /api/public/commits</code></span>
              </div>
            </div>
            <div className="border-t border-rule md:border-l md:border-t-0">
              <pre className="terminal m-4 overflow-x-auto rounded-xl p-4 md:m-6">
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
