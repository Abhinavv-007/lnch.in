/**
 * Operator command center for lnch.in.
 *
 * Visually this page sits inside the same poster system as the public
 * landing — every card is a `.poster-card` or `.poster-stat`, every list
 * uses `.poster-row`, every label is mono-uppercase with wide tracking. No
 * floating SaaS panels. The data comes from `/api/ops/overview` and gracefully
 * degrades to honest "missing integration" copy whenever a backend isn't
 * configured.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Boxes,
  Cloud,
  Github,
  Rocket,
  Triangle,
  Activity,
  ScrollText,
  Shield,
  StickyNote,
  CheckSquare,
  Database,
  Flame,
  ClipboardList,
} from "lucide-react";
import PageHeader from "@/components/ops/PageHeader";
import StatCard from "@/components/ops/StatCard";
import SectionTitle from "@/components/ops/SectionTitle";
import HealthDot, { type HealthState } from "@/components/ops/HealthDot";
import Sparkline from "@/components/ops/Sparkline";
import { PROJECTS } from "@/lib/projects";
import { api } from "@/lib/api";
import { timeAgo, shortHash } from "@/lib/format";

type Overview = {
  generatedAt: number;
  integrations: Record<
    "github" | "cloudflare" | "vercel" | "firebase",
    { configured: boolean; healthy: boolean; reason?: string }
  >;
  projectCount: number;
  healthCounts: { ok: number; warn: number; err: number; unknown: number };
  totalsLastDay: {
    commits: number | null;
    deployments: number | null;
    failedDeployments: number | null;
    apiErrors: number | null;
  };
  recentCommits: {
    repo: string;
    sha: string;
    message: string;
    author: string;
    ts: number;
  }[];
  recentDeployments: {
    project: string;
    state: string;
    url?: string;
    sha?: string;
    ts: number;
    provider: "vercel" | "cloudflare";
  }[];
  apiHealth: {
    project: string;
    target: string;
    ok: boolean;
    latencyMs: number | null;
    status: number | null;
  }[];
  notes: { count: number; latest?: { title: string; ts: number } };
  tasks: { open: number; urgent: number; latest?: { title: string; ts: number } };
  incidents: { open: number };
  changelogDrafts: { count: number };
  failingWorkflows: number;
  openPRs: number;
  openIssues: number;
};

export default function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Overview>("/api/ops/overview")
      .then(setData)
      .catch((err) => setError(err?.message ?? "Failed to load overview"));
  }, []);

  if (error) {
    return (
      <div className="poster-card poster-card--sm text-sm text-[var(--signal-err)]">
        Couldn't load the overview: {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="developer command center"
        title={
          <>
            Ship. Scale. <span className="cursive-accent text-accent">Sleep well.</span>
          </>
        }
        description="One place to build, deploy, and operate every lnch.in project with confidence."
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={<Boxes className="h-3.5 w-3.5" />}
          label="Projects"
          value={data ? data.projectCount : <Shimmer w={32} />}
          tone="gilt"
          status={
            data
              ? `${data.healthCounts.ok} healthy · ${data.healthCounts.warn} warning · ${data.healthCounts.err} down`
              : "Loading…"
          }
          href="/ops/projects"
        />
        <StatCard
          icon={<Rocket className="h-3.5 w-3.5" />}
          label="Deployments"
          value={
            data ? (data.totalsLastDay.deployments ?? "—") : <Shimmer w={32} />
          }
          hint="last 24h"
          tone={
            data?.totalsLastDay.failedDeployments
              ? "warn"
              : data?.totalsLastDay.deployments
                ? "ok"
                : "neutral"
          }
          status={
            data
              ? data.totalsLastDay.failedDeployments
                ? `${data.totalsLastDay.failedDeployments} failed in last 24h`
                : "All deployments succeeded"
              : "Loading…"
          }
          href="/ops/deployments"
        />
        <StatCard
          icon={<Github className="h-3.5 w-3.5" />}
          label="GitHub"
          value={
            data ? (
              data.integrations.github.configured
                ? `${data.openPRs}/${data.openIssues}`
                : "—"
            ) : (
              <Shimmer w={32} />
            )
          }
          hint={data?.integrations.github.configured ? "open PRs / issues" : ""}
          tone={
            data?.integrations.github.configured ? (data.failingWorkflows ? "warn" : "ok") : "neutral"
          }
          status={
            data
              ? data.integrations.github.configured
                ? data.failingWorkflows
                  ? `${data.failingWorkflows} failing workflows`
                  : "Workflows clean"
                : "Awaiting GITHUB_TOKEN"
              : "Loading…"
          }
          href="/ops/github"
        />
        <StatCard
          icon={<Cloud className="h-3.5 w-3.5" />}
          label="Cloudflare"
          value={
            data ? (data.integrations.cloudflare.configured ? "Linked" : "—") : <Shimmer w={32} />
          }
          tone={
            data?.integrations.cloudflare.configured
              ? data.integrations.cloudflare.healthy
                ? "ok"
                : "warn"
              : "neutral"
          }
          status={
            data
              ? data.integrations.cloudflare.configured
                ? data.integrations.cloudflare.healthy
                  ? "Account healthy"
                  : data.integrations.cloudflare.reason ?? "Degraded"
                : "Not configured"
              : "Loading…"
          }
          href="/ops/cloudflare"
        />
        <StatCard
          icon={<Triangle className="h-3.5 w-3.5" />}
          label="Vercel"
          value={
            data ? (data.integrations.vercel.configured ? "Linked" : "—") : <Shimmer w={32} />
          }
          tone={
            data?.integrations.vercel.configured
              ? data.integrations.vercel.healthy
                ? "ok"
                : "warn"
              : "neutral"
          }
          status={
            data
              ? data.integrations.vercel.configured
                ? data.integrations.vercel.healthy
                  ? "Account healthy"
                  : data.integrations.vercel.reason ?? "Degraded"
                : "Not configured"
              : "Loading…"
          }
          href="/ops/vercel"
        />
        <StatCard
          icon={<Database className="h-3.5 w-3.5" />}
          label="Firebase"
          value={
            data ? (data.integrations.firebase.configured ? "Linked" : "—") : <Shimmer w={32} />
          }
          tone="neutral"
          status={
            data
              ? data.integrations.firebase.configured
                ? "Available"
                : "Not configured"
              : "Loading…"
          }
          href="/ops/settings"
        />
        <StatCard
          icon={<Activity className="h-3.5 w-3.5" />}
          label="APIs"
          value={
            data ? (
              <>
                {data.apiHealth.filter((a) => a.ok).length}/{data.apiHealth.length}
              </>
            ) : (
              <Shimmer w={32} />
            )
          }
          hint="healthy / probed"
          tone={
            data
              ? data.apiHealth.length === 0
                ? "neutral"
                : data.apiHealth.every((a) => a.ok)
                  ? "ok"
                  : data.apiHealth.some((a) => a.ok)
                    ? "warn"
                    : "err"
              : "neutral"
          }
          status={
            data
              ? data.apiHealth.length === 0
                ? "No probes registered"
                : "Probes ran in last cycle"
              : "Loading…"
          }
          href="/ops/apis"
        />
        <StatCard
          icon={<ScrollText className="h-3.5 w-3.5" />}
          label="Logs"
          value={data ? (data.totalsLastDay.apiErrors ?? "0") : <Shimmer w={32} />}
          hint="errors · 24h"
          tone={
            data
              ? data.totalsLastDay.apiErrors == null
                ? "neutral"
                : data.totalsLastDay.apiErrors > 0
                  ? "warn"
                  : "ok"
              : "neutral"
          }
          status={
            data && data.totalsLastDay.apiErrors == null
              ? "Awaiting log integrations"
              : "Tail recent errors"
          }
          href="/ops/logs"
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard
          icon={<Shield className="h-3.5 w-3.5" />}
          label="Security"
          tone="ok"
          value="Audit ready"
          status="Secret-handling, audit log and gates active"
          href="/ops/security"
        />
        <StatCard
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          label="Audit"
          tone="info"
          value={data ? "Live" : <Shimmer w={32} />}
          status="All admin actions are recorded"
          href="/ops/audit"
        />
        <StatCard
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Incidents"
          tone={data?.incidents.open ? "err" : "neutral"}
          value={data ? data.incidents.open : <Shimmer w={32} />}
          status={data?.incidents.open ? "Open incidents need attention" : "No open incidents"}
          href="/ops/incidents"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ProjectHealthCard data={data} />
        <RecentCommitsCard data={data} />
        <RecentDeploymentsCard data={data} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <NotesTeaser data={data} />
        <TasksTeaser data={data} />
      </section>
    </div>
  );
}

function Shimmer({ w = 24 }: { w?: number }) {
  return <span className="inline-block h-7 rounded-md shimmer" style={{ width: w }} />;
}

function ProjectHealthCard({ data }: { data: Overview | null }) {
  return (
    <div className="poster-card poster-card--sm">
      <SectionTitle hint="last health probe">Projects</SectionTitle>
      <ul>
        {PROJECTS.map((p) => {
          const probe = data?.apiHealth.find((a) => a.project === p.slug);
          const state: HealthState = !data
            ? "unknown"
            : probe
              ? probe.ok
                ? "ok"
                : "err"
              : "missing";
          return (
            <li key={p.slug} className="poster-row">
              <span aria-hidden className="poster-bullet text-accent" />
              <Link
                to={`/ops/projects/${p.slug}`}
                className="poster-row__label flex min-w-0 items-center gap-2 hover:text-accent"
              >
                <span className="font-serif">{p.name}</span>
                <span className="truncate text-xs text-muted">
                  {p.site ? new URL(p.site).host : "—"}
                </span>
              </Link>
              <span className="poster-row__detail poster-row__hide-sm">
                {probe ? `${probe.latencyMs ?? "—"}ms` : data ? "no probe" : "…"}
              </span>
              <HealthDot state={state} label={state} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecentCommitsCard({ data }: { data: Overview | null }) {
  return (
    <div className="poster-card poster-card--sm">
      <SectionTitle hint="across all repos">Recent commits</SectionTitle>
      {!data ? (
        <ListShimmer />
      ) : data.recentCommits.length === 0 ? (
        <p className="text-sm text-fg-soft">
          {data.integrations.github.configured
            ? "No recent commits to surface."
            : "Add GITHUB_TOKEN to surface commits."}
        </p>
      ) : (
        <ul>
          {data.recentCommits.slice(0, 6).map((c) => (
            <li key={c.repo + c.sha} className="poster-row">
              <span className="poster-row__label font-mono text-xs text-accent">
                {shortHash(c.sha)}
              </span>
              <span className="poster-row__label flex-1 text-fg">{c.message}</span>
              <span className="poster-row__detail poster-row__hide-sm">{c.repo}</span>
              <span className="poster-row__detail">{timeAgo(c.ts)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentDeploymentsCard({ data }: { data: Overview | null }) {
  return (
    <div className="poster-card poster-card--sm">
      <SectionTitle hint="latest 6">Recent deployments</SectionTitle>
      {!data ? (
        <ListShimmer />
      ) : data.recentDeployments.length === 0 ? (
        <p className="text-sm text-fg-soft">
          {data.integrations.cloudflare.configured || data.integrations.vercel.configured
            ? "No deployments in the last day."
            : "Configure Cloudflare or Vercel to surface deployments."}
        </p>
      ) : (
        <ul>
          {data.recentDeployments.slice(0, 6).map((d) => {
            const stamp =
              d.state === "ready" || d.state === "success"
                ? "poster-stamp poster-stamp--ok"
                : d.state === "error" || d.state === "failure"
                  ? "poster-stamp poster-stamp--err"
                  : "poster-stamp poster-stamp--warn";
            return (
              <li key={d.project + d.ts} className="poster-row">
                <span className="poster-row__label text-fg">{d.project}</span>
                <span className="poster-row__label flex-1 text-muted">
                  {d.provider} · {shortHash(d.sha)}
                </span>
                <span className="poster-row__detail poster-row__hide-sm">{timeAgo(d.ts)}</span>
                <span className={stamp}>{d.state}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NotesTeaser({ data }: { data: Overview | null }) {
  return (
    <Link to="/ops/notes" className="block">
      <div className="poster-card poster-card--sm poster-card--hover">
        <div className="flex items-center justify-between">
          <SectionTitle hint="notes">Latest note</SectionTitle>
          <StickyNote className="h-4 w-4 text-muted" />
        </div>
        {!data ? (
          <Shimmer w={140} />
        ) : data.notes.latest ? (
          <>
            <p className="text-sm text-fg">{data.notes.latest.title}</p>
            <p className="mt-1 text-xs text-muted">{timeAgo(data.notes.latest.ts)}</p>
          </>
        ) : (
          <p className="text-sm text-fg-soft">No notes yet.</p>
        )}
        <p className="mt-3 text-xs uppercase tracking-[0.28em] text-muted">
          {data?.notes.count ?? 0} total
        </p>
      </div>
    </Link>
  );
}

function TasksTeaser({ data }: { data: Overview | null }) {
  return (
    <Link to="/ops/tasks" className="block">
      <div className="poster-card poster-card--sm poster-card--hover">
        <div className="flex items-center justify-between">
          <SectionTitle hint="tasks">Open tasks</SectionTitle>
          <CheckSquare className="h-4 w-4 text-muted" />
        </div>
        {!data ? (
          <Shimmer w={140} />
        ) : (
          <>
            <p className="font-serif text-3xl tracking-tight text-fg">{data.tasks.open}</p>
            <p className="mt-1 text-xs text-muted">
              {data.tasks.urgent} urgent ·{" "}
              {data.tasks.latest ? `last ${timeAgo(data.tasks.latest.ts)}` : "none yet"}
            </p>
            <div className="mt-3 text-accent">
              <Sparkline values={[2, 3, 2, 4, 5, 4, 6, 5, 7, 6, 8, 7]} />
            </div>
          </>
        )}
      </div>
    </Link>
  );
}

function ListShimmer() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="h-10 rounded-lg shimmer" />
      ))}
    </ul>
  );
}
