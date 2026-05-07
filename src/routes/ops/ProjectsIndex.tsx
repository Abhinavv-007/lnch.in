/**
 * Projects index for the operator console.
 *
 * Lists every registered project as a poster card with health, deploy, and
 * commit signal. Mirrors the public landing card system but adds the operator
 * affordances (admin link, mobile/desktop badges).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Github, Globe, Smartphone } from "lucide-react";
import PageHeader from "@/components/ops/PageHeader";
import StatCard from "@/components/ops/StatCard";
import HealthDot, { type HealthState } from "@/components/ops/HealthDot";
import { PROJECTS } from "@/lib/projects";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type ProjectSummary = {
  slug: string;
  name: string;
  health: { state: HealthState; latencyMs: number | null };
  github: {
    configured: boolean;
    latestCommit: { sha: string; message: string; author: string; ts: number } | null;
    openPRs: number;
    openIssues: number;
  };
  deployments: {
    provider: string;
    latest: { state: string; ts: number; sha?: string } | null;
  } | null;
  apis: { ok: number; total: number };
  admin: { available: boolean };
};

export default function ProjectsIndex() {
  const [data, setData] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ projects: ProjectSummary[] }>("/api/ops/projects")
      .then((r) => setData(r.projects))
      .catch((err) => setError(err?.message ?? "Failed to load projects"));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="projects"
        title={
          <>
            Every <span className="cursive-accent text-accent">project</span> in flight
          </>
        }
        description="Live health, latest commit, deploy status, and admin readiness for every project under lnch.in."
      />

      {error ? (
        <div className="poster-card poster-card--sm text-sm text-[var(--signal-err)]">
          Couldn't load: {error}
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PROJECTS.map((p) => {
          const summary = data?.find((d) => d.slug === p.slug) ?? null;
          const state: HealthState = summary?.health.state ?? "unknown";
          return (
            <li key={p.slug}>
              <Link
                to={`/ops/projects/${p.slug}`}
                className="poster-card poster-card--sm poster-card--hover group flex h-full flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="poster-eyebrow">{p.kind}</p>
                    <p className="mt-1 font-serif text-2xl tracking-tight text-fg">{p.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-fg-soft">{p.blurb}</p>
                  </div>
                  <HealthDot state={state} label={state} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <StatCard
                    label="Probes"
                    value={summary ? `${summary.apis.ok}/${summary.apis.total}` : "…"}
                    tone={summary ? (summary.apis.total === 0 ? "neutral" : summary.apis.ok === summary.apis.total ? "ok" : summary.apis.ok > 0 ? "warn" : "err") : "neutral"}
                    status={summary && summary.apis.total === 0 ? "no probes" : "healthy / total"}
                  />
                  <StatCard
                    label="Deploys"
                    value={summary?.deployments?.latest?.state ?? "—"}
                    tone={
                      summary?.deployments?.latest
                        ? summary.deployments.latest.state === "ready" ||
                          summary.deployments.latest.state === "success"
                          ? "ok"
                          : "warn"
                        : "neutral"
                    }
                    status={
                      summary?.deployments?.latest
                        ? `${summary.deployments.provider} · ${timeAgo(summary.deployments.latest.ts)}`
                        : "no deploy"
                    }
                  />
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-muted">
                  {p.site ? (
                    <span className="poster-stamp">
                      <Globe className="h-3 w-3" /> {new URL(p.site).host}
                    </span>
                  ) : null}
                  <span className="poster-stamp">
                    <Github className="h-3 w-3" /> {p.repo}
                  </span>
                  {p.mobileApps?.map((m) => (
                    <span key={m.label} className="poster-stamp">
                      <Smartphone className="h-3 w-3" /> {m.label}
                    </span>
                  ))}
                  <span
                    className={
                      summary?.admin.available
                        ? "poster-stamp poster-stamp--ok"
                        : "poster-stamp"
                    }
                  >
                    {summary?.admin.available ? "admin live" : "admin pending"}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-fg-soft transition group-hover:text-accent">
                    Open <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
