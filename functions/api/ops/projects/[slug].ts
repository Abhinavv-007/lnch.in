/**
 * GET /api/ops/projects/:slug
 * Detailed view used by /ops/projects/:slug.
 */
import { type Env, err, json } from "../../../_lib/env";
import { gate } from "../_gate";
import { PROJECT_BY_SLUG } from "../../../_lib/projects";
import { GithubAdapter } from "../../../_adapters/github";
import { VercelAdapter } from "../../../_adapters/vercel";
import { CloudflareAdapter } from "../../../_adapters/cloudflare";
import * as firebase from "../../../_adapters/firebase";
import { ModihAdapter } from "../../../_adapters/modih";
import { PortfolioAdapter } from "../../../_adapters/portfolio";
import { ProjectAdminAdapter } from "../../../_adapters/projectAdmin";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const g = await gate(request, env);
  if (g) return g;
  const slug = String(params.slug);
  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "unknown project");

  const gh = new GithubAdapter(env);
  const vc = new VercelAdapter(env);
  const cf = new CloudflareAdapter(env);

  // GitHub bundle.
  const ghBundle = gh.isConfigured()
    ? await Promise.all([
        gh.listCommits(project.repo, 12).catch(() => []),
        gh.listBranches(project.repo).catch(() => []),
        gh.listOpenPRs(project.repo).catch(() => []),
        gh.listOpenIssues(project.repo).catch(() => []),
        gh.listFailingWorkflows(project.repo).catch(() => []),
        gh.listReleases(project.repo).catch(() => []),
      ])
    : null;

  // Health probes.
  const apis: { target: string; ok: boolean; latencyMs: number | null; status: number | null }[] = [];
  for (const t of project.health ?? []) {
    const start = Date.now();
    try {
      const res = await fetch(t, { redirect: "manual" });
      apis.push({ target: t, ok: res.ok || res.status === 405, latencyMs: Date.now() - start, status: res.status });
    } catch {
      apis.push({ target: t, ok: false, latencyMs: Date.now() - start, status: null });
    }
  }
  const overallOk = apis.length === 0 ? null : apis.every((a) => a.ok);
  const fastest = apis.length ? Math.min(...apis.map((a) => a.latencyMs ?? 9999)) : null;

  // Deployment summary — best-effort match by name substring.
  let deployments: { provider: string; latest: any; recent: any[] } | null = null;
  if (vc.isConfigured()) {
    const all = await vc.listRecentDeployments(40).catch(() => []);
    const matches = all.filter((d: any) => d.name?.toLowerCase().includes(slug));
    if (matches.length) {
      deployments = {
        provider: "vercel",
        latest: matches[0]
          ? {
              state: matches[0].state?.toLowerCase() ?? "unknown",
              ts: matches[0].createdAt,
              url: matches[0].url,
              sha: matches[0].meta?.githubCommitSha,
            }
          : null,
        recent: matches.slice(0, 10).map((d: any) => ({
          state: d.state?.toLowerCase() ?? "unknown",
          ts: d.createdAt,
          sha: d.meta?.githubCommitSha,
        })),
      };
    }
  }
  if (!deployments && cf.isConfigured()) {
    const projects = await cf.listPagesProjects().catch(() => []);
    const match = projects.find((p: any) => p.name?.toLowerCase().includes(slug));
    if (match) {
      const recent = await cf.listPagesDeployments((match as any).name).catch(() => []);
      deployments = {
        provider: "cloudflare",
        latest: recent[0]
          ? {
              state: (recent[0] as any).latest_stage?.status === "success" ? "ready" : ((recent[0] as any).latest_stage?.status ?? "queued"),
              ts: Date.parse((recent[0] as any).created_on),
              sha: (recent[0] as any).deployment_trigger?.metadata?.commit_hash,
            }
          : null,
        recent: recent.map((r: any) => ({
          state: r.latest_stage?.status === "success" ? "ready" : (r.latest_stage?.status ?? "queued"),
          ts: Date.parse(r.created_on),
          sha: r.deployment_trigger?.metadata?.commit_hash,
        })),
      };
    }
  }

  // Admin module.
  let admin: { available: boolean; needs: string[]; plannedEndpoints: string[]; snapshot?: Record<string, number | string | null> } = {
    available: false,
    needs: [project.adminSecretEnv],
    plannedEndpoints: [],
  };
  if (slug === "modih") {
    admin = await new ModihAdapter(env).overview();
  } else if (slug === "portfolio") {
    // Portfolio doesn't have an admin API — it has a public read-only API
    // at abhnv.in/api/*. The PortfolioAdapter speaks that surface and
    // produces the same admin-shaped overview so the UI doesn't have to
    // special-case it.
    admin = await new PortfolioAdapter(env).overview();
  } else if (project.adminBaseUrl) {
    admin = await new ProjectAdminAdapter(env, project).overview();
  }

  // Firebase analytics.
  const firebaseInfo = firebase.isConfigured(env, slug)
    ? await firebase.getUserCount(env, slug)
    : { projectId: undefined, userCount: null, reason: "not configured" };

  return json({
    slug,
    health: { state: overallOk == null ? "unknown" : overallOk ? "ok" : "err", latencyMs: fastest },
    github: ghBundle
      ? {
          configured: true,
          commits: ghBundle[0],
          openPRs: ghBundle[2].length,
          openIssues: ghBundle[3].length,
          failingWorkflows: ghBundle[4].length,
          releases: ghBundle[5],
          branches: ghBundle[1].slice(0, 24),
        }
      : null,
    deployments,
    apis,
    admin,
    firebase: {
      configured: firebase.isConfigured(env, slug),
      projectId: firebaseInfo.projectId,
      userCount: firebaseInfo.userCount,
      reason: firebaseInfo.reason,
    },
  });
};
