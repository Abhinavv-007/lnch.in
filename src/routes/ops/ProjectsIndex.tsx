import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Github, Globe, Smartphone } from "lucide-react";
import PageHeader from "@/components/ops/PageHeader";
import HealthDot, { type HealthState } from "@/components/ops/HealthDot";
import { PROJECTS } from "@/lib/projects";
import { api } from "@/lib/api";
import { timeAgo, shortHash } from "@/lib/format";

type ProjectSummary = {
  slug: string;
  health: HealthState;
  latencyMs: number | null;
  latestCommit: { sha: string; message: string; ts: number } | null;
  latestDeployment: { state: string; provider: string; ts: number } | null;
  openIssues: number | null;
  openPRs: number | null;
};

export default function ProjectsIndex() {
  const [data, setData] = useState<Record<string, ProjectSummary> | null>(null);
  useEffect(() => {
    api
      .get<{ projects: ProjectSummary[] }>("/api/ops/projects")
      .then((r) => setData(Object.fromEntries(r.projects.map((p) => [p.slug, p]))))
      .catch(() => setData({}));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="all projects"
        title={
          <>
            Projects in flight <span className="text-ink-300">·</span>{" "}
            <span className="italic text-gilt-300">{PROJECTS.length}</span>
          </>
        }
        description="Live health, latest deploys and the GitHub heartbeat for every project."
      />

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PROJECTS.map((p) => {
          const s = data?.[p.slug];
          return (
            <li key={p.slug}>
              <Link
                to={`/ops/projects/${p.slug}`}
                className="panel-glow flex h-full flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:border-gilt-700/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-serif text-2xl tracking-tight ${p.accent}`}>{p.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-200">{p.blurb}</p>
                  </div>
                  <HealthDot state={s?.health ?? "unknown"} label={s?.latencyMs ? `${s.latencyMs}ms` : "—"} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Latest commit" value={s?.latestCommit ? shortHash(s.latestCommit.sha) : "—"} hint={s?.latestCommit ? timeAgo(s.latestCommit.ts) : ""} />
                  <Stat label="Latest deploy" value={s?.latestDeployment ? s.latestDeployment.state : "—"} hint={s?.latestDeployment ? timeAgo(s.latestDeployment.ts) : ""} />
                  <Stat label="Open PRs" value={s?.openPRs ?? "—"} />
                  <Stat label="Open issues" value={s?.openIssues ?? "—"} />
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-ink-300">
                  {p.site ? (
                    <span className="pill"><Globe className="h-3 w-3" /> {new URL(p.site).host}</span>
                  ) : null}
                  <span className="pill"><Github className="h-3 w-3" /> {p.repo}</span>
                  {p.mobileApps?.map((m) => (
                    <span key={m.label} className="pill"><Smartphone className="h-3 w-3" /> {m.label}</span>
                  ))}
                  <span className="ml-auto inline-flex items-center gap-1 text-ink-200">
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

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-ink-600/40 bg-ink-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink-300">{label}</p>
      <p className="mt-0.5 truncate text-sm text-ink-100">{value}</p>
      {hint ? <p className="text-[11px] text-ink-300">{hint}</p> : null}
    </div>
  );
}
