/**
 * Project detail surface — 13-tab admin/operator view per project.
 *
 * Tab layout (from `PROJECT_DETAIL_SECTIONS`):
 *   overview · health · users · api-consumers · api-keys · audit ·
 *   deployments · changelog · security · tasks · notes · analytics · settings
 *
 * Data flow:
 *   - Common header data (`Detail`) comes from `/api/ops/projects/:slug`,
 *     which aggregates github + deploys + probes + admin overview snapshot
 *     in a single fetch.
 *   - Per-tab data (users, api-keys, etc.) is lazy-loaded from
 *     `/api/ops/projects/:slug/admin/:topic`, the per-topic proxy. The
 *     proxy adds the per-project `<SLUG>_ADMIN_SECRET` server-side and
 *     relays the upstream JSON. When the secret or upstream URL is
 *     missing, the proxy returns `available:false` and the panel renders
 *     a `<MissingIntegration>` card with the exact env var to set —
 *     never fabricated data.
 *   - Tasks/Notes pull from LaunchOps-side D1 (filtered by project).
 *
 * Each Section is a component so the file can grow without one massive
 * switch. Loading/missing/empty/data states are explicit on every panel.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { ArrowUpRight, Github, Globe, Smartphone } from "lucide-react";
import PageHeader from "@/components/ops/PageHeader";
import HealthDot from "@/components/ops/HealthDot";
import MissingIntegration from "@/components/ops/MissingIntegration";
import StatCard from "@/components/ops/StatCard";
import SectionTitle from "@/components/ops/SectionTitle";
import {
  PROJECTS_BY_SLUG,
  PROJECT_DETAIL_SECTIONS,
  PROJECT_DETAIL_LABELS,
  type Project,
  type ProjectDetailSection,
  type ProjectAdminTopic,
} from "@/lib/projects";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { compactNumber, shortHash, timeAgo } from "@/lib/format";

type Detail = {
  slug: string;
  health: { state: "ok" | "warn" | "err" | "unknown" | "missing"; latencyMs: number | null };
  github: {
    configured: boolean;
    commits: { sha: string; message: string; author: string; ts: number }[];
    openPRs: number;
    openIssues: number;
    failingWorkflows: number;
    releases: { name: string; tag: string; ts: number }[];
    branches: string[];
  } | null;
  deployments: {
    provider: string;
    latest: { state: string; url?: string; sha?: string; ts: number } | null;
    recent: { state: string; ts: number; sha?: string }[];
  } | null;
  apis: { target: string; ok: boolean; latencyMs: number | null; status: number | null }[];
  admin: {
    available: boolean;
    needs: string[];
    plannedEndpoints: string[];
    snapshot?: Record<string, number | string | null>;
  };
  firebase: { configured: boolean; projectId?: string; userCount?: number | null; reason?: string };
};

type TopicState = {
  loading: boolean;
  available: boolean;
  needs: string[];
  plannedEndpoint: string;
  reason?: string;
  status?: number;
  data?: unknown;
  error?: string;
};

/**
 * Lazy fetch for a single per-project admin topic. Returns the union of
 * loading + the upstream's TopicResponse so panels can branch on a single
 * piece of state.
 */
function useAdminTopic(slug: string | undefined, topic: ProjectAdminTopic | null): TopicState {
  const [state, setState] = useState<TopicState>({
    loading: true,
    available: false,
    needs: [],
    plannedEndpoint: "",
  });

  useEffect(() => {
    if (!slug || !topic) return;
    setState({
      loading: true,
      available: false,
      needs: [],
      plannedEndpoint: "",
    });
    api
      .get<{
        slug: string;
        topic: string;
        available: boolean;
        needs: string[];
        plannedEndpoint: string;
        reason?: string;
        status?: number;
        data?: unknown;
      }>(`/api/ops/projects/${slug}/admin/${topic}`)
      .then((r) =>
        setState({
          loading: false,
          available: r.available,
          needs: r.needs,
          plannedEndpoint: r.plannedEndpoint,
          reason: r.reason,
          status: r.status,
          data: r.data,
        }),
      )
      .catch((err: Error) =>
        setState({
          loading: false,
          available: false,
          needs: [],
          plannedEndpoint: "",
          error: err?.message ?? "Failed to load",
        }),
      );
  }, [slug, topic]);

  return state;
}

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
      .catch((e) => setError(e?.message ?? "Failed to load project"));
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
            <HealthDot
              state={detail?.health.state ?? "unknown"}
              label={detail?.health.latencyMs ? `${detail.health.latencyMs}ms` : "—"}
            />
            {project.site ? (
              <a href={project.site} target="_blank" rel="noreferrer" className="btn-ghost">
                <Globe className="h-4 w-4" /> Open site <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <a
              href={`https://github.com/${project.repo}`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
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
            {PROJECT_DETAIL_LABELS[s]}
          </NavLink>
        ))}
      </nav>

      {error ? <div className="panel p-5 text-sm signal-err">Couldn&apos;t load: {error}</div> : null}

      {active === "overview" && <OverviewSection project={project} detail={detail} />}
      {active === "health" && <HealthSection project={project} detail={detail} />}
      {active === "users" && <UsersSection project={project} />}
      {active === "api-consumers" && <ApiConsumersSection project={project} />}
      {active === "api-keys" && <ApiKeysSection project={project} />}
      {active === "audit" && <AuditSection project={project} />}
      {active === "deployments" && <DeploymentsSection detail={detail} />}
      {active === "changelog" && <ChangelogSection project={project} detail={detail} />}
      {active === "security" && <SecuritySection project={project} />}
      {active === "tasks" && <TasksSection project={project} />}
      {active === "notes" && <NotesSection project={project} />}
      {active === "analytics" && <AnalyticsSection project={project} detail={detail} />}
      {active === "settings" && <SettingsSection project={project} detail={detail} />}
    </div>
  );
}

/* ---------- 1. Overview ---------- */

function OverviewSection({ project, detail }: { project: Project; detail: Detail | null }) {
  const apiState = detail
    ? detail.apis.length === 0
      ? "—"
      : detail.apis.every((a) => a.ok)
        ? "Healthy"
        : detail.apis.some((a) => a.ok)
          ? "Degraded"
          : "Down"
    : "…";
  const apiTone = detail
    ? detail.apis.length === 0
      ? "neutral"
      : detail.apis.every((a) => a.ok)
        ? "ok"
        : detail.apis.some((a) => a.ok)
          ? "warn"
          : "err"
    : "neutral";

  return (
    <div className="space-y-4">
      <section className="poster-stagger grid gap-3 md:grid-cols-3">
        <StatCard
          label="API status"
          value={apiState}
          tone={apiTone}
          status={
            detail
              ? detail.apis.length
                ? `${detail.apis.filter((a) => a.ok).length}/${detail.apis.length} probes ok`
                : "No health probes registered"
              : "Loading"
          }
        />
        <StatCard
          label="Latest commit"
          value={detail?.github?.commits[0] ? shortHash(detail.github.commits[0].sha) : "—"}
          tone="gilt"
          status={
            detail?.github?.commits[0]
              ? `${detail.github.commits[0].author} · ${timeAgo(detail.github.commits[0].ts)}`
              : detail?.github?.configured
                ? "No commits in window"
                : "Awaiting GITHUB_TOKEN"
          }
        />
        <StatCard
          label="Latest deploy"
          value={detail?.deployments?.latest?.state ?? "—"}
          tone={
            detail?.deployments?.latest?.state === "ready" ||
            detail?.deployments?.latest?.state === "success"
              ? "ok"
              : detail?.deployments?.latest?.state
                ? "warn"
                : "neutral"
          }
          status={
            detail?.deployments?.latest
              ? `${detail.deployments.provider} · ${timeAgo(detail.deployments.latest.ts)}`
              : "No recent deployment"
          }
        />
      </section>

      {detail?.github?.configured ? (
        <section className="poster-stagger grid gap-3 md:grid-cols-3">
          <StatCard label="Open PRs" value={detail.github.openPRs} tone="info" />
          <StatCard
            label="Open issues"
            value={detail.github.openIssues}
            tone={detail.github.openIssues > 5 ? "warn" : "neutral"}
          />
          <StatCard
            label="Failing workflows"
            value={detail.github.failingWorkflows}
            tone={detail.github.failingWorkflows ? "err" : "ok"}
          />
        </section>
      ) : null}

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
        </div>
      ) : null}

      {detail?.github?.configured ? (
        <div className="panel p-5">
          <SectionTitle hint={`${detail.github.commits.length} latest`}>Recent commits</SectionTitle>
          <ul className="divide-rule">
            {detail.github.commits.slice(0, 8).map((c) => (
              <li
                key={c.sha}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-accent">{shortHash(c.sha)}</span>
                <span className="truncate">{c.message.split("\n")[0]}</span>
                <span className="text-xs text-muted">
                  {c.author} · {timeAgo(c.ts)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link to={`/ops/projects/${project.slug}/users`} className="block">
        <div className="panel p-5 hover:border-accent">
          <SectionTitle>Admin module</SectionTitle>
          <p className="text-sm text-fg-soft">
            {detail?.admin.available
              ? "Admin endpoints connected. Browse users, keys, audit, security from the tabs above."
              : "Project-side admin endpoints aren't shipped yet. lnch.in will surface real data once they exist."}
          </p>
        </div>
      </Link>
    </div>
  );
}

/* ---------- 2. Health ---------- */

function HealthSection({ project, detail }: { project: Project; detail: Detail | null }) {
  const adminHealth = useAdminTopic(project.slug, "health");

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <SectionTitle hint={`${detail?.apis.length ?? 0} probes`}>Public probes</SectionTitle>
        {!detail ? (
          <p className="text-sm text-fg-soft">Loading…</p>
        ) : detail.apis.length === 0 ? (
          <p className="text-sm text-fg-soft">
            No health probes registered for this project. Add endpoints to the project registry in{" "}
            <Link to="/ops/settings" className="text-accent underline">
              Settings
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-rule text-sm">
            {detail.apis.map((a) => (
              <li key={a.target} className="flex items-center justify-between py-2">
                <span className="truncate font-mono text-xs">{a.target}</span>
                <span className="flex items-center gap-3 text-xs">
                  <span className="text-muted">
                    {a.latencyMs ?? "—"}ms · {a.status ?? "—"}
                  </span>
                  <HealthDot state={a.ok ? "ok" : "err"} label={a.ok ? "ok" : "down"} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TopicPanel
        title="Admin health snapshot"
        topicState={adminHealth}
        project={project}
        empty="Admin /health endpoint exists but returned an empty body."
      >
        {(data) => <FlatSnapshot data={data} />}
      </TopicPanel>
    </div>
  );
}

/* ---------- 3. Users ---------- */

function UsersSection({ project }: { project: Project }) {
  const t = useAdminTopic(project.slug, "users");
  return (
    <TopicPanel
      title={`${project.name} users`}
      topicState={t}
      project={project}
      empty="No users returned by the admin /users endpoint."
    >
      {(data) => <RecordList data={data} kind="user" />}
    </TopicPanel>
  );
}

/* ---------- 4. API consumers ---------- */

function ApiConsumersSection({ project }: { project: Project }) {
  const t = useAdminTopic(project.slug, "api-consumers");
  return (
    <TopicPanel
      title={`${project.name} API consumers`}
      topicState={t}
      project={project}
      empty="No API consumers reported by the admin /api-consumers endpoint."
    >
      {(data) => <RecordList data={data} kind="consumer" />}
    </TopicPanel>
  );
}

/* ---------- 5. API keys ---------- */

function ApiKeysSection({ project }: { project: Project }) {
  const t = useAdminTopic(project.slug, "api-keys");
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Keys are masked. lnch.in never exposes raw secrets — the upstream is expected to redact
        them server-side.
      </p>
      <TopicPanel
        title={`${project.name} API keys`}
        topicState={t}
        project={project}
        empty="No API keys reported by the admin /api-keys endpoint."
      >
        {(data) => <RecordList data={data} kind="key" />}
      </TopicPanel>
    </div>
  );
}

/* ---------- 6. Audit (project-side) ---------- */

function AuditSection({ project }: { project: Project }) {
  const t = useAdminTopic(project.slug, "audit");
  return (
    <TopicPanel
      title={`${project.name} audit log`}
      topicState={t}
      project={project}
      empty="No audit events reported by the admin /audit endpoint."
    >
      {(data) => <RecordList data={data} kind="event" />}
    </TopicPanel>
  );
}

/* ---------- 7. Deployments ---------- */

function DeploymentsSection({ detail }: { detail: Detail | null }) {
  if (!detail) return <PanelSkeleton title="Deployments" />;
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
      <SectionTitle hint={d.provider}>Recent deployments</SectionTitle>
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

/* ---------- 8. Changelog ---------- */

type Draft = {
  id: number;
  project_slug: string;
  title: string;
  body: string;
  status: string;
  updated_at: number;
};

function ChangelogSection({ project, detail }: { project: Project; detail: Detail | null }) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  useEffect(() => {
    api
      .get<{ drafts: Draft[] }>("/api/ops/changelogs")
      .then((r) => setDrafts(r.drafts.filter((d) => d.project_slug === project.slug)))
      .catch(() => setDrafts([]));
  }, [project.slug]);

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <SectionTitle
          hint={`${drafts?.length ?? 0} drafts`}
          action={
            <Link to="/ops/changelogs" className="btn-ghost text-xs">
              Open changelog center
            </Link>
          }
        >
          Drafts &amp; releases
        </SectionTitle>
        {drafts === null ? (
          <p className="text-sm text-fg-soft">Loading…</p>
        ) : drafts.length === 0 ? (
          <p className="text-sm text-fg-soft">
            No changelog drafts for {project.name} yet. Generate one from{" "}
            <Link to="/ops/changelogs" className="text-accent underline">
              /ops/changelogs
            </Link>{" "}
            using recent commits.
          </p>
        ) : (
          <ul className="divide-rule text-sm">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className={d.status === "published" ? "pill-ok" : "pill-warn"}>
                    {d.status}
                  </span>{" "}
                  <span className="text-fg">{d.title}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{timeAgo(d.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel p-5">
        <SectionTitle hint={`${detail?.github?.releases.length ?? 0} releases`}>
          GitHub releases
        </SectionTitle>
        {!detail?.github?.configured ? (
          <p className="text-sm text-fg-soft">Configure GITHUB_TOKEN to surface releases.</p>
        ) : detail.github.releases.length === 0 ? (
          <p className="text-sm text-fg-soft">No releases tagged on this repo yet.</p>
        ) : (
          <ul className="divide-rule text-sm">
            {detail.github.releases.map((r) => (
              <li key={r.tag} className="flex items-center justify-between gap-3 py-2">
                <span>{r.name}</span>
                <span className="text-xs text-muted">
                  {r.tag} · {timeAgo(r.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- 9. Security ---------- */

function SecuritySection({ project }: { project: Project }) {
  const t = useAdminTopic(project.slug, "security");
  return (
    <TopicPanel
      title={`${project.name} security posture`}
      topicState={t}
      project={project}
      empty="No security data returned by the admin /security endpoint."
    >
      {(data) => <FlatSnapshot data={data} />}
    </TopicPanel>
  );
}

/* ---------- 10. Tasks (LaunchOps-side, project-scoped) ---------- */

type Task = {
  id: number;
  title: string;
  body: string | null;
  project_slug: string | null;
  status: "open" | "blocked" | "shipped" | "archived";
  priority: number;
  tags: string | null;
  created_at: number;
  updated_at: number;
};

function TasksSection({ project }: { project: Project }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  useEffect(() => {
    api
      .get<{ tasks: Task[] }>(`/api/ops/tasks?project=${encodeURIComponent(project.slug)}`)
      .then((r) => setTasks(r.tasks))
      .catch(() => setTasks([]));
  }, [project.slug]);
  return (
    <div className="panel p-5">
      <SectionTitle
        hint={`${tasks?.length ?? 0} tasks`}
        action={
          <Link to="/ops/tasks" className="btn-ghost text-xs">
            New / manage in /ops/tasks
          </Link>
        }
      >
        Tasks scoped to {project.name}
      </SectionTitle>
      {tasks === null ? (
        <p className="text-sm text-fg-soft">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-fg-soft">
          No tasks scoped to this project yet. Add one from{" "}
          <Link to="/ops/tasks" className="text-accent underline">
            /ops/tasks
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-rule text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium text-fg">
                  <span
                    className={
                      t.priority === 1 ? "pill-err" : t.priority === 2 ? "pill-warn" : "pill"
                    }
                  >
                    P{t.priority}
                  </span>{" "}
                  <span
                    className={
                      t.status === "shipped"
                        ? "pill-ok"
                        : t.status === "blocked"
                          ? "pill-err"
                          : "pill-info"
                    }
                  >
                    {t.status}
                  </span>{" "}
                  {t.title}
                </p>
                <p className="text-[11px] text-muted">{timeAgo(t.updated_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- 11. Notes (LaunchOps-side, project-scoped) ---------- */

type Note = {
  id: number;
  title: string;
  body: string;
  project_slug: string | null;
  tags: string | null;
  created_at: number;
  updated_at: number;
};

function NotesSection({ project }: { project: Project }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  useEffect(() => {
    api
      .get<{ notes: Note[] }>(`/api/ops/notes?project=${encodeURIComponent(project.slug)}`)
      .then((r) => setNotes(r.notes))
      .catch(() => setNotes([]));
  }, [project.slug]);
  return (
    <div className="panel p-5">
      <SectionTitle
        hint={`${notes?.length ?? 0} notes`}
        action={
          <Link to="/ops/notes" className="btn-ghost text-xs">
            New / manage in /ops/notes
          </Link>
        }
      >
        Notes scoped to {project.name}
      </SectionTitle>
      {notes === null ? (
        <p className="text-sm text-fg-soft">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-fg-soft">
          No notes scoped to this project yet. Capture one from{" "}
          <Link to="/ops/notes" className="text-accent underline">
            /ops/notes
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-rule text-sm">
          {notes.map((n) => (
            <li key={n.id} className="py-2">
              <p className="font-medium text-fg">{n.title}</p>
              <p className="line-clamp-2 text-xs text-muted">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted">{timeAgo(n.updated_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- 12. Analytics ---------- */

function AnalyticsSection({ project, detail }: { project: Project; detail: Detail | null }) {
  const t = useAdminTopic(project.slug, "analytics");
  if (!detail) return <PanelSkeleton title="Analytics" />;
  return (
    <div className="space-y-4">
      <section className="poster-stagger grid gap-3 md:grid-cols-3">
        <StatCard
          label="Users"
          value={detail.firebase.configured ? compactNumber(detail.firebase.userCount ?? 0) : "—"}
          tone="gilt"
          status={
            detail.firebase.configured
              ? `Firebase · ${detail.firebase.projectId}`
              : "Awaiting FIREBASE_*"
          }
        />
        <StatCard
          label="Open PRs"
          value={detail.github?.openPRs ?? "—"}
          tone={detail.github?.configured ? "info" : "neutral"}
          status={detail.github?.configured ? undefined : "Awaiting GITHUB_TOKEN"}
        />
        <StatCard
          label="Latest deploy"
          value={detail.deployments?.latest?.state ?? "—"}
          tone={
            detail.deployments?.latest?.state === "ready" ||
            detail.deployments?.latest?.state === "success"
              ? "ok"
              : detail.deployments?.latest?.state
                ? "warn"
                : "neutral"
          }
        />
      </section>

      <TopicPanel
        title={`${project.name} project analytics`}
        topicState={t}
        project={project}
        empty="No data returned by the admin /analytics endpoint."
      >
        {(data) => <FlatSnapshot data={data} />}
      </TopicPanel>
    </div>
  );
}

/* ---------- 13. Settings ---------- */

function SettingsSection({ project, detail }: { project: Project; detail: Detail | null }) {
  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <SectionTitle hint="from src/lib/projects.ts">Project registry</SectionTitle>
        <ul className="divide-rule text-sm">
          <SettingRow label="Slug" value={project.slug} mono />
          <SettingRow label="Name" value={project.name} />
          <SettingRow label="Kind" value={project.kind} />
          <SettingRow label="Repo" value={project.repo} mono />
          {project.site ? <SettingRow label="Site" value={project.site} mono /> : null}
          <SettingRow label="Admin secret" value={project.adminSecretEnv ?? "—"} mono />
        </ul>
      </div>

      <div className="panel p-5">
        <SectionTitle hint="health endpoints registered">Probes</SectionTitle>
        {project.health?.length ? (
          <ul className="divide-rule text-sm">
            {project.health.map((h) => (
              <li key={h} className="py-2 font-mono text-xs">
                {h}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-soft">No health probes registered.</p>
        )}
      </div>

      <div className="panel p-5">
        <SectionTitle>Admin proxy state</SectionTitle>
        {detail?.admin.available ? (
          <p className="text-sm">
            <span className="pill-ok">connected</span>{" "}
            <span className="text-fg-soft">
              The {project.adminSecretEnv} secret is set and the upstream is responding.
            </span>
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="pill-warn">not yet shipped</span>{" "}
              <span className="text-fg-soft">
                The {project.name} project hasn&apos;t exposed the admin endpoints lnch.in proxies
                to.
              </span>
            </p>
            {detail ? (
              <ul className="space-y-1 text-xs font-mono text-fg-soft">
                {detail.admin.plannedEndpoints.map((e) => (
                  <li
                    key={e}
                    className="rounded-md border border-rule bg-paper-elev px-2.5 py-1.5"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Shared building blocks ---------- */

/**
 * Wraps a topic state in the standard loading/missing/empty/data flow.
 * Children get the upstream's parsed `data`; only called when
 * `topicState.available && data is not null/undefined/empty array`.
 */
function TopicPanel({
  title,
  topicState,
  project,
  empty,
  children,
}: {
  title: string;
  topicState: TopicState;
  project: Project;
  empty: string;
  children: (data: unknown) => ReactNode;
}) {
  if (topicState.loading) return <PanelSkeleton title={title} />;
  if (topicState.error) {
    return <div className="panel p-5 text-sm signal-err">Couldn&apos;t load: {topicState.error}</div>;
  }
  if (!topicState.available) {
    return (
      <div className="space-y-3">
        <MissingIntegration
          title={title}
          reason={
            topicState.reason ??
            `${project.name} hasn't shipped this admin endpoint yet, or its secret isn't configured on lnch.in.`
          }
          hint={`lnch.in calls ${topicState.plannedEndpoint || "the upstream admin endpoint"} server-side.`}
          needs={topicState.needs}
        />
      </div>
    );
  }
  if (isEmpty(topicState.data)) {
    return (
      <div className="panel p-5">
        <SectionTitle>{title}</SectionTitle>
        <p className="text-sm text-fg-soft">{empty}</p>
        <p className="mt-2 text-[11px] font-mono text-muted">{topicState.plannedEndpoint}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="panel p-5">
        <SectionTitle>{title}</SectionTitle>
        {children(topicState.data)}
        <p className="mt-3 text-[11px] font-mono text-muted">{topicState.plannedEndpoint}</p>
      </div>
    </div>
  );
}

function PanelSkeleton({ title }: { title: string }) {
  return (
    <div className="panel p-5">
      <SectionTitle>{title}</SectionTitle>
      <p className="text-sm text-fg-soft">Loading…</p>
    </div>
  );
}

function isEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return (obj.items as unknown[]).length === 0;
    if (Array.isArray(obj.results)) return (obj.results as unknown[]).length === 0;
    if (Array.isArray(obj.events)) return (obj.events as unknown[]).length === 0;
    if (Array.isArray(obj.users)) return (obj.users as unknown[]).length === 0;
    if (Array.isArray(obj.keys)) return (obj.keys as unknown[]).length === 0;
    if (Array.isArray(obj.consumers)) return (obj.consumers as unknown[]).length === 0;
    return Object.keys(obj).length === 0;
  }
  return false;
}

/**
 * Render an arbitrary admin upstream response that we can't strongly type
 * yet. Tries hard not to look like fake data:
 *  - Arrays / `{items: []}` / `{users: []}` etc → row list (top fields).
 *  - Otherwise → recursive fallback via FlatSnapshot.
 *
 * `kind` is just a hint for the row layout (a user vs an audit event).
 */
function RecordList({
  data,
  kind,
}: {
  data: unknown;
  kind: "user" | "key" | "consumer" | "event";
}) {
  const items = useMemo(() => extractItems(data), [data]);
  if (items === null) return <FlatSnapshot data={data} />;

  if (items.length === 0) {
    return <p className="text-sm text-fg-soft">No items returned.</p>;
  }

  return (
    <ul className="divide-rule text-sm">
      {items.slice(0, 50).map((item, i) => (
        <li key={i} className="py-2">
          <RecordRow item={item} kind={kind} />
        </li>
      ))}
      {items.length > 50 ? (
        <li className="py-2 text-xs text-muted">… {items.length - 50} more (truncated)</li>
      ) : null}
    </ul>
  );
}

function RecordRow({
  item,
  kind,
}: {
  item: Record<string, unknown>;
  kind: "user" | "key" | "consumer" | "event";
}) {
  const id = pick(item, ["id", "uid", "key", "user_id", "consumer_id", "actor"]);
  const primary = pick(item, ["email", "name", "label", "action", "title", "username"]);
  const secondary = pick(item, ["plan", "status", "role", "scope", "target", "ip"]);
  const ts = pickNumber(item, [
    "created_at",
    "createdAt",
    "ts",
    "updated_at",
    "last_used_at",
    "time",
  ]);

  const tone =
    kind === "key" || kind === "consumer"
      ? "pill"
      : kind === "user"
        ? "pill-info"
        : "pill-warn";

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-fg">
          {primary ?? id ?? <span className="text-muted">unnamed</span>}
        </p>
        <p className="truncate text-[11px] text-muted">
          {[id !== primary ? id : null, secondary].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {secondary ? <span className={tone}>{secondary}</span> : null}
        {ts ? <span className="text-[11px] text-muted">{timeAgo(ts)}</span> : null}
      </div>
    </div>
  );
}

function extractItems(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) return data.filter(isObject) as Record<string, unknown>[];
  if (isObject(data)) {
    for (const k of ["items", "results", "events", "users", "keys", "consumers", "data"]) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v.filter(isObject) as Record<string, unknown>[];
    }
  }
  return null;
}

/**
 * Last-resort renderer for unknown response shapes. Flattens up to 2 levels
 * deep so the operator can still see what the upstream actually returned —
 * better than fabricating a structured panel.
 */
function FlatSnapshot({ data }: { data: unknown }) {
  const flat = useMemo(() => flatten("", data, 0, {}), [data]);
  const entries = Object.entries(flat);
  if (entries.length === 0) {
    return <p className="text-sm text-fg-soft">Empty response.</p>;
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {entries.slice(0, 24).map(([k, v]) => (
        <li
          key={k}
          className="flex items-center justify-between gap-3 rounded-md border border-rule-soft bg-paper-elev px-3 py-2 text-xs"
        >
          <span className="truncate font-mono text-muted">{k}</span>
          <span className="truncate text-fg">{String(v)}</span>
        </li>
      ))}
      {entries.length > 24 ? (
        <li className="text-xs text-muted">… {entries.length - 24} more (truncated)</li>
      ) : null}
    </ul>
  );
}

/* ---------- Helpers ---------- */

function SettingRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-xs uppercase tracking-[0.22em] text-muted">{label}</span>
      <span className={cn("truncate", mono && "font-mono text-xs")}>{value}</span>
    </li>
  );
}

function isObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : v;
    if (typeof v === "string" && /^\d+$/.test(v)) {
      const n = Number(v);
      return n > 1e12 ? Math.floor(n / 1000) : n;
    }
  }
  return null;
}

function flatten(
  prefix: string,
  value: unknown,
  depth: number,
  out: Record<string, string | number>,
): Record<string, string | number> {
  if (value == null) return out;
  if (typeof value === "number" || typeof value === "string") {
    out[prefix || "value"] = value;
    return out;
  }
  if (typeof value === "boolean") {
    out[prefix || "value"] = value ? "true" : "false";
    return out;
  }
  if (Array.isArray(value)) {
    out[prefix ? `${prefix}.count` : "count"] = value.length;
    return out;
  }
  if (typeof value === "object" && depth < 2) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flatten(prefix ? `${prefix}.${k}` : k, v, depth + 1, out);
    }
  }
  return out;
}
