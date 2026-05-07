/**
 * Project detail surface — Overview, Admin, GitHub, Deployments, APIs, Logs,
 * Analytics, Notes, Tasks, Changelog, Security, Settings, Mobile, Incidents,
 * Releases.
 *
 * Sub-section is the second URL segment; we render different cards per section
 * but reuse the project header.
 */
import { useEffect, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { ArrowUpRight, Github, Globe, Smartphone } from "lucide-react";
import PageHeader from "@/components/ops/PageHeader";
import HealthDot from "@/components/ops/HealthDot";
import MissingIntegration from "@/components/ops/MissingIntegration";
import StatCard from "@/components/ops/StatCard";
import SectionTitle from "@/components/ops/SectionTitle";
import { PROJECTS_BY_SLUG, PROJECT_DETAIL_SECTIONS, type Project, type ProjectDetailSection } from "@/lib/projects";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { compactNumber, shortHash, timeAgo } from "@/lib/format";

type Detail = {
  slug: string;
  health: { state: "ok" | "warn" | "err" | "unknown" | "missing"; latencyMs: number | null };
  github: { configured: boolean; commits: { sha: string; message: string; author: string; ts: number }[]; openPRs: number; openIssues: number; failingWorkflows: number; releases: { name: string; tag: string; ts: number }[]; branches: string[] } | null;
  deployments: { provider: string; latest: { state: string; url?: string; sha?: string; ts: number } | null; recent: { state: string; ts: number; sha?: string }[] } | null;
  apis: { target: string; ok: boolean; latencyMs: number | null; status: number | null }[];
  admin: {
    available: boolean;
    needs: string[];
    plannedEndpoints: string[];
    snapshot?: Record<string, number | string | null>;
  };
  firebase: { configured: boolean; projectId?: string; userCount?: number | null; reason?: string };
};

export default function ProjectDetail() {
  const { slug, section } = useParams<{ slug: string; section?: string }>();
  const project = slug ? PROJECTS_BY_SLUG[slug] : undefined;
  const active = (PROJECT_DETAIL_SECTIONS as readonly string[]).includes(section ?? "")
    ? (section as ProjectDetailSection)
    : "overview";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setDetail(null);
    setError(null);
    api
      .get<Detail>(`/api/ops/projects/${project.slug}`)
      .then(setDetail)
      .catch((err) => setError(err?.message ?? "Failed to load project"));
  }, [project]);

  if (!project) {
    return <p className="text-sm signal-err">Unknown project.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={project.kind}
        title={
          <>
            <span className={project.accent}>{project.name}</span>
          </>
        }
        description={project.blurb}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HealthDot state={detail?.health.state ?? "unknown"} label={detail?.health.latencyMs ? `${detail.health.latencyMs}ms` : "—"} />
            {project.site ? (
              <a href={project.site} target="_blank" rel="noreferrer" className="btn-ghost">
                <Globe className="h-4 w-4" /> Open site <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <a href={`https://github.com/${project.repo}`} target="_blank" rel="noreferrer" className="btn-ghost">
              <Github className="h-4 w-4" /> GitHub <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        }
      />

      <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto pb-1 text-sm">
        {PROJECT_DETAIL_SECTIONS.map((s) => (
          <NavLink
            key={s}
            to={`/ops/projects/${project.slug}/${s}`}
            className={({ isActive }) =>
              cn(
                "shrink-0 rounded-full border px-3 py-1.5 transition",
                isActive || (s === "overview" && active === "overview")
                  ? "border-accent bg-accent-soft text-accent shadow-gilt-sm poster-active-edge"
                  : "border-rule bg-paper-elev text-fg-soft hover:text-fg hover:border-accent",
              )
            }
            end
          >
            {s}
          </NavLink>
        ))}
      </nav>

      {error ? (
        <div className="panel p-5 text-sm signal-err">Couldn't load: {error}</div>
      ) : null}

      {active === "overview" && <OverviewSection project={project} detail={detail} />}
      {active === "admin" && <AdminSection project={project} detail={detail} />}
      {active === "github" && <GithubSection detail={detail} />}
      {active === "deployments" && <DeploymentsSection detail={detail} />}
      {active === "apis" && <ApisSection detail={detail} />}
      {active === "logs" && <Placeholder title="Logs" hint="Tail recent error logs for this project." />}
      {active === "analytics" && <AnalyticsSection project={project} detail={detail} />}
      {active === "notes" && <Placeholder title="Notes" hint="Project-scoped notes (jump to /ops/notes for global)." />}
      {active === "tasks" && <Placeholder title="Tasks" hint="Project-scoped tasks (jump to /ops/tasks for global)." />}
      {active === "changelog" && <Placeholder title="Changelog" hint="Generate release notes from commits in /ops/changelogs." />}
      {active === "security" && <Placeholder title="Security" hint="Per-project token / passkey / audit summary." />}
      {active === "settings" && <Placeholder title="Settings" hint="Edit project registry, mapping, health endpoints." />}
    </div>
  );
}

function OverviewSection({
  project,
  detail,
}: {
  project: Project;
  detail: Detail | null;
}) {
  return (
    <div className="space-y-4">
      <section className="poster-stagger grid gap-3 md:grid-cols-3">
        <StatCard
          label="API status"
          value={detail ? (detail.apis.every((a) => a.ok) && detail.apis.length ? "Healthy" : detail.apis.some((a) => a.ok) ? "Degraded" : detail.apis.length === 0 ? "—" : "Down") : "…"}
          tone={detail ? (detail.apis.length === 0 ? "neutral" : detail.apis.every((a) => a.ok) ? "ok" : detail.apis.some((a) => a.ok) ? "warn" : "err") : "neutral"}
          status={detail ? (detail.apis.length ? `${detail.apis.filter((a) => a.ok).length}/${detail.apis.length} probes ok` : "No health probes registered") : "Loading"}
        />
        <StatCard
          label="Latest commit"
          value={detail?.github?.commits[0] ? shortHash(detail.github.commits[0].sha) : "—"}
          tone="gilt"
          status={detail?.github?.commits[0] ? `${detail.github.commits[0].author} · ${timeAgo(detail.github.commits[0].ts)}` : detail?.github?.configured ? "No commits in window" : "Awaiting GITHUB_TOKEN"}
        />
        <StatCard
          label="Latest deploy"
          value={detail?.deployments?.latest?.state ?? "—"}
          tone={detail?.deployments?.latest?.state === "ready" || detail?.deployments?.latest?.state === "success" ? "ok" : detail?.deployments?.latest?.state ? "warn" : "neutral"}
          status={detail?.deployments?.latest ? `${detail.deployments.provider} · ${timeAgo(detail.deployments.latest.ts)}` : "No recent deployment"}
        />
      </section>

      {project.mobileApps?.length ? (
        <div className="panel p-5">
          <SectionTitle hint="mobile apps shipped under this project">Mobile</SectionTitle>
          <ul className="flex flex-wrap gap-2 text-sm">
            {project.mobileApps.map((m) => (
              <li key={m.label} className="pill">
                <Smartphone className="h-3 w-3" /> {m.platform} · {m.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Mobile apps appear under their parent project — they're not first-class LaunchOps targets.
          </p>
        </div>
      ) : null}

      <Link to={`/ops/projects/${project.slug}/admin`} className="block">
        <div className="panel p-5 hover:border-accent">
          <SectionTitle>Admin module</SectionTitle>
          <p className="text-sm text-fg-soft">
            {detail?.admin.available
              ? "Admin endpoints connected. Open the Admin tab for controls."
              : "Project-side admin endpoints aren't shipped yet for this project."}
          </p>
        </div>
      </Link>
    </div>
  );
}

function AdminSection({
  project,
  detail,
}: {
  project: Project;
  detail: Detail | null;
}) {
  if (!detail) return <Placeholder title="Admin" hint="Loading…" />;
  if (!detail.admin.available) {
    return (
      <div className="space-y-4">
        <MissingIntegration
          title={`${project.name} admin endpoints not yet shipped`}
          reason="LaunchOps will surface real admin metrics & controls once these endpoints exist on the project."
          hint={`Use ${project.adminSecretEnv ?? "LAUNCHOPS_ADMIN_SECRET"} once the project exposes the planned API.`}
          needs={detail.admin.needs}
        />
        <div className="panel p-5">
          <SectionTitle hint="planned · not available yet">Endpoints LaunchOps will call</SectionTitle>
          <ul className="space-y-1 text-xs font-mono text-fg-soft">
            {detail.admin.plannedEndpoints.map((e) => (
              <li key={e} className="rounded-md border border-rule bg-paper-elev px-2.5 py-1.5">
                {e}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  const snap = detail.admin.snapshot ?? {};
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Object.entries(snap).map(([k, v]) => (
        <StatCard
          key={k}
          label={k}
          value={typeof v === "number" ? compactNumber(v) : (v ?? "—")}
          tone="gilt"
        />
      ))}
    </div>
  );
}

function GithubSection({ detail }: { detail: Detail | null }) {
  if (!detail) return <Placeholder title="GitHub" hint="Loading…" />;
  if (!detail.github?.configured) {
    return (
      <MissingIntegration
        title="GITHUB_TOKEN not configured"
        reason="LaunchOps needs a GitHub token to surface commits, branches, PRs, issues and workflows."
        needs={["GITHUB_TOKEN"]}
      />
    );
  }
  const g = detail.github;
  return (
    <div className="space-y-4">
      <section className="poster-stagger grid gap-3 md:grid-cols-3">
        <StatCard label="Open PRs" value={g.openPRs} tone="info" />
        <StatCard label="Open issues" value={g.openIssues} tone={g.openIssues > 5 ? "warn" : "neutral"} />
        <StatCard label="Failing workflows" value={g.failingWorkflows} tone={g.failingWorkflows ? "err" : "ok"} />
      </section>

      <div className="panel p-5">
        <SectionTitle hint={`${g.commits.length} latest`}>Commits</SectionTitle>
        <ul className="divide-rule">
          {g.commits.map((c) => (
            <li key={c.sha} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2 text-sm">
              <span className="font-mono text-xs text-accent">{shortHash(c.sha)}</span>
              <span className="truncate">{c.message}</span>
              <span className="text-xs text-muted">
                {c.author} · {timeAgo(c.ts)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle>Branches</SectionTitle>
          <ul className="flex flex-wrap gap-1.5 text-xs">
            {g.branches.map((b) => (
              <li key={b} className="pill">{b}</li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <SectionTitle>Releases</SectionTitle>
          <ul className="space-y-1 text-sm">
            {g.releases.length === 0 ? (
              <li className="text-fg-soft">No releases.</li>
            ) : (
              g.releases.map((r) => (
                <li key={r.tag} className="flex justify-between border-b border-rule-soft py-1.5">
                  <span>{r.name}</span>
                  <span className="text-xs text-muted">
                    {r.tag} · {timeAgo(r.ts)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DeploymentsSection({ detail }: { detail: Detail | null }) {
  if (!detail) return <Placeholder title="Deployments" hint="Loading…" />;
  if (!detail.deployments) {
    return (
      <MissingIntegration
        title="No deployment provider linked for this project"
        reason="Connect Cloudflare Pages or Vercel to surface deployment history."
        needs={["CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID", "VERCEL_TOKEN"]}
      />
    );
  }
  const d = detail.deployments;
  return (
    <div className="panel p-5">
      <SectionTitle hint={`${d.provider}`}>Recent deployments</SectionTitle>
      {d.recent.length === 0 ? (
        <p className="text-sm text-fg-soft">No deployments in the last cycle.</p>
      ) : (
        <ul className="divide-rule text-sm">
          {d.recent.map((r) => (
            <li key={r.ts} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2">
                <span
                  className={
                    r.state === "ready" || r.state === "success"
                      ? "pill-ok"
                      : r.state === "error" || r.state === "failure"
                        ? "pill-err"
                        : "pill-warn"
                  }
                >
                  {r.state}
                </span>
                <span className="font-mono text-xs text-muted">{shortHash(r.sha)}</span>
              </span>
              <span className="text-xs text-muted">{timeAgo(r.ts)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApisSection({ detail }: { detail: Detail | null }) {
  if (!detail) return <Placeholder title="APIs" hint="Loading…" />;
  if (detail.apis.length === 0) {
    return <Placeholder title="APIs" hint="No health probes registered for this project. Add endpoints in /ops/settings." />;
  }
  return (
    <div className="panel p-5">
      <SectionTitle>Probes</SectionTitle>
      <ul className="divide-rule text-sm">
        {detail.apis.map((a) => (
          <li key={a.target} className="flex items-center justify-between py-2">
            <span className="truncate font-mono text-xs">{a.target}</span>
            <span className="flex items-center gap-3 text-xs">
              <span className="text-fg-soft">{a.latencyMs ?? "—"}ms · {a.status ?? "—"}</span>
              <HealthDot state={a.ok ? "ok" : "err"} label={a.ok ? "ok" : "down"} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalyticsSection({
  project,
  detail,
}: {
  project: Project;
  detail: Detail | null;
}) {
  if (!detail) return <Placeholder title="Analytics" hint="Loading…" />;
  if (!detail.firebase.configured) {
    return (
      <MissingIntegration
        title={`No analytics source linked for ${project.name}`}
        reason="LaunchOps reads user counts via Firebase Auth (admin SDK). Configure a Firebase service account for this project to populate this view."
        needs={[`FIREBASE_${project.slug.toUpperCase()}`]}
      />
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Users" value={compactNumber(detail.firebase.userCount ?? 0)} tone="gilt" status={`Firebase project · ${detail.firebase.projectId}`} />
    </div>
  );
}

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="panel p-6">
      <SectionTitle>{title}</SectionTitle>
      <p className="text-sm text-fg-soft">{hint}</p>
    </div>
  );
}
