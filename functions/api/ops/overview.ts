/**
 * GET /api/ops/overview
 *
 * Composite snapshot used by the LaunchOps dashboard. Calls real adapters
 * concurrently with `Promise.allSettled` so a single broken integration
 * doesn't sink the whole page; each integration's status is reported
 * honestly under `integrations`.
 */
import { type Env, json, nowSec } from "../../_lib/env";
import { gate } from "./_gate";
import { GithubAdapter } from "../../_adapters/github";
import { CloudflareAdapter } from "../../_adapters/cloudflare";
import { VercelAdapter } from "../../_adapters/vercel";
import * as firebase from "../../_adapters/firebase";
import { PROJECTS } from "../../_lib/projects";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;

  const gh = new GithubAdapter(env);
  const cf = new CloudflareAdapter(env);
  const vc = new VercelAdapter(env);

  const ghPromise = gh.isConfigured()
    ? Promise.allSettled(PROJECTS.map((p) => gh.listCommits(p.repo, 4)))
    : Promise.resolve([]);
  const ghPRsPromise = gh.isConfigured()
    ? Promise.allSettled(PROJECTS.map((p) => gh.listOpenPRs(p.repo)))
    : Promise.resolve([]);
  const ghIssuesPromise = gh.isConfigured()
    ? Promise.allSettled(PROJECTS.map((p) => gh.listOpenIssues(p.repo)))
    : Promise.resolve([]);
  const ghFailingPromise = gh.isConfigured()
    ? Promise.allSettled(PROJECTS.map((p) => gh.listFailingWorkflows(p.repo)))
    : Promise.resolve([]);

  const cfDeploysPromise = cf.isConfigured()
    ? cf.listPagesProjects().then((projects) =>
        Promise.allSettled(projects.slice(0, 8).map((p) => cf.listPagesDeployments(p.name).then((deps) => deps.map((d) => ({ ...d, project: p.name }))))),
      ).catch(() => [])
    : Promise.resolve([]);
  const vcDeploysPromise = vc.isConfigured() ? vc.listRecentDeployments(20).catch(() => []) : Promise.resolve([]);

  const [ghCommits, ghPRs, ghIssues, ghFailing, cfDeploys, vcDeploys, ghTokenHealth, cfTokenHealth, vcTokenHealth] = await Promise.all([
    ghPromise,
    ghPRsPromise,
    ghIssuesPromise,
    ghFailingPromise,
    cfDeploysPromise,
    vcDeploysPromise,
    gh.isConfigured() ? gh.tokenScopeHealth() : Promise.resolve({ ok: false }),
    cf.isConfigured() ? cf.tokenHealth().catch((error) => ({ ok: false, reason: error instanceof Error ? error.message : "Cloudflare health check failed" })) : Promise.resolve({ ok: false }),
    vc.isConfigured() ? vc.tokenHealth().catch((error) => ({ ok: false, reason: error instanceof Error ? error.message : "Vercel health check failed" })) : Promise.resolve({ ok: false }),
  ]);

  // Recent commits flatten + sort.
  const recentCommits = (Array.isArray(ghCommits) ? ghCommits : [])
    .flatMap((r, i) => (r.status === "fulfilled" ? r.value.map((c) => ({ ...c, repo: PROJECTS[i].repo })) : []))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 12);

  const openPRs = (Array.isArray(ghPRs) ? ghPRs : []).reduce((s, r) => s + (r.status === "fulfilled" ? r.value.length : 0), 0);
  const openIssues = (Array.isArray(ghIssues) ? ghIssues : []).reduce((s, r) => s + (r.status === "fulfilled" ? r.value.length : 0), 0);
  const failingWorkflows = (Array.isArray(ghFailing) ? ghFailing : []).reduce((s, r) => s + (r.status === "fulfilled" ? r.value.length : 0), 0);

  // Recent deployments (CF + Vercel, normalized).
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const cfFlat = (Array.isArray(cfDeploys) ? cfDeploys : []).flatMap((r) =>
    r.status === "fulfilled"
      ? r.value.map((d: any) => ({
          project: d.project,
          provider: "cloudflare" as const,
          state: d.latest_stage?.status === "success" ? "ready" : (d.latest_stage?.status ?? "queued"),
          sha: d.deployment_trigger?.metadata?.commit_hash,
          ts: Date.parse(d.created_on),
        }))
      : [],
  );
  const vcFlat = (Array.isArray(vcDeploys) ? vcDeploys : []).map((d: any) => ({
    project: d.name,
    provider: "vercel" as const,
    state: d.state?.toLowerCase?.() ?? "unknown",
    sha: d.meta?.githubCommitSha,
    ts: d.createdAt,
    url: d.url,
  }));
  const recentDeployments = [...cfFlat, ...vcFlat]
    .filter((d) => d.ts > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);
  const last24hDeployments = [...cfFlat, ...vcFlat].filter((d) => d.ts >= dayAgo);
  const failed24h = last24hDeployments.filter((d) => ["error", "failure", "failed"].includes(d.state)).length;

  // Health probes (HEAD/GET against project health URLs).
  const apiHealth: { project: string; target: string; ok: boolean; latencyMs: number | null; status: number | null }[] = [];
  await Promise.all(
    PROJECTS.flatMap((p) =>
      (p.health ?? []).map(async (target) => {
        const start = Date.now();
        try {
          const res = await fetch(target, { method: "GET", redirect: "manual" });
          apiHealth.push({ project: p.slug, target, ok: res.ok || res.status === 405 || res.status === 0, latencyMs: Date.now() - start, status: res.status });
        } catch {
          apiHealth.push({ project: p.slug, target, ok: false, latencyMs: Date.now() - start, status: null });
        }
      }),
    ),
  );

  // Health counts roll-up per project.
  const healthCounts = { ok: 0, warn: 0, err: 0, unknown: 0 };
  for (const p of PROJECTS) {
    const probes = apiHealth.filter((a) => a.project === p.slug);
    if (probes.length === 0) healthCounts.unknown++;
    else if (probes.every((a) => a.ok)) healthCounts.ok++;
    else if (probes.some((a) => a.ok)) healthCounts.warn++;
    else healthCounts.err++;
  }

  // Notes / tasks / incidents teaser straight from D1.
  const notesCount = (await env.DB.prepare("SELECT COUNT(*) as c FROM launchops_notes").first<{ c: number }>())?.c ?? 0;
  const noteLatest = await env.DB.prepare("SELECT title, updated_at FROM launchops_notes ORDER BY updated_at DESC LIMIT 1").first<{ title: string; updated_at: number }>();
  const tasksOpen = (await env.DB.prepare("SELECT COUNT(*) as c FROM launchops_tasks WHERE status = 'open'").first<{ c: number }>())?.c ?? 0;
  const tasksUrgent = (await env.DB.prepare("SELECT COUNT(*) as c FROM launchops_tasks WHERE status = 'open' AND priority = 1").first<{ c: number }>())?.c ?? 0;
  const taskLatest = await env.DB.prepare("SELECT title, updated_at FROM launchops_tasks ORDER BY updated_at DESC LIMIT 1").first<{ title: string; updated_at: number }>();
  const incidentsOpen = (await env.DB.prepare("SELECT COUNT(*) as c FROM launchops_incidents WHERE status != 'resolved'").first<{ c: number }>())?.c ?? 0;
  const drafts = (await env.DB.prepare("SELECT COUNT(*) as c FROM launchops_changelog_drafts WHERE status = 'draft'").first<{ c: number }>())?.c ?? 0;

  return json({
    generatedAt: nowSec(),
    integrations: {
      github: { configured: gh.isConfigured(), healthy: !!ghTokenHealth.ok, reason: (ghTokenHealth as any).reason },
      cloudflare: { configured: cf.isConfigured(), healthy: !!(cfTokenHealth as any).ok, reason: (cfTokenHealth as any).reason },
      vercel: { configured: vc.isConfigured(), healthy: !!(vcTokenHealth as any).ok, reason: (vcTokenHealth as any).reason },
      firebase: { configured: firebase.isConfigured(env), healthy: firebase.isConfigured(env) },
    },
    projectCount: PROJECTS.length,
    healthCounts,
    totalsLastDay: {
      commits: recentCommits.length,
      deployments: last24hDeployments.length,
      failedDeployments: failed24h,
      apiErrors: null,
    },
    recentCommits,
    recentDeployments,
    apiHealth,
    notes: { count: notesCount, latest: noteLatest ? { title: noteLatest.title, ts: noteLatest.updated_at } : undefined },
    tasks: { open: tasksOpen, urgent: tasksUrgent, latest: taskLatest ? { title: taskLatest.title, ts: taskLatest.updated_at } : undefined },
    incidents: { open: incidentsOpen },
    changelogDrafts: { count: drafts },
    failingWorkflows,
    openPRs,
    openIssues,
    _projectByRepo: undefined as never,
  });
};
