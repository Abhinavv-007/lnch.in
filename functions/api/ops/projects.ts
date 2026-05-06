/**
 * GET /api/ops/projects
 * Returns a per-project summary used by /ops/projects.
 */
import { type Env, json } from "../../_lib/env";
import { gate } from "./_gate";
import { PROJECTS } from "../../_lib/projects";
import { GithubAdapter } from "../../_adapters/github";
import { VercelAdapter } from "../../_adapters/vercel";
import { CloudflareAdapter } from "../../_adapters/cloudflare";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const gh = new GithubAdapter(env);
  const vc = new VercelAdapter(env);
  const cf = new CloudflareAdapter(env);

  const vercelDeployments = vc.isConfigured() ? await vc.listRecentDeployments(50).catch(() => []) : [];
  const cfPages = cf.isConfigured() ? await cf.listPagesProjects().catch(() => []) : [];

  const projects = await Promise.all(
    PROJECTS.map(async (p) => {
      const [commits, prs, issues] = await Promise.all([
        gh.isConfigured() ? gh.listCommits(p.repo, 1).catch(() => []) : Promise.resolve([]),
        gh.isConfigured() ? gh.listOpenPRs(p.repo).catch(() => []) : Promise.resolve([]),
        gh.isConfigured() ? gh.listOpenIssues(p.repo).catch(() => []) : Promise.resolve([]),
      ]);
      let latencyMs: number | null = null;
      let healthOk: boolean | null = null;
      if (p.health?.[0]) {
        const start = Date.now();
        try {
          const res = await fetch(p.health[0], { redirect: "manual" });
          latencyMs = Date.now() - start;
          healthOk = res.ok || res.status === 405;
        } catch {
          latencyMs = Date.now() - start;
          healthOk = false;
        }
      }
      const vercelMatch = vercelDeployments.find((d: any) => d.name?.toLowerCase().includes(p.slug));
      const cfMatch = cfPages.find((c: any) => c.name?.toLowerCase().includes(p.slug));
      const latestDeployment = vercelMatch
        ? { state: (vercelMatch as any).state?.toLowerCase?.() ?? "unknown", provider: "vercel", ts: (vercelMatch as any).createdAt }
        : cfMatch && (cfMatch as any).latest_deployment
          ? { state: (cfMatch as any).latest_deployment?.stage ?? "unknown", provider: "cloudflare", ts: Date.parse((cfMatch as any).latest_deployment?.modified_on ?? "") || 0 }
          : null;
      return {
        slug: p.slug,
        health: healthOk == null ? "unknown" : healthOk ? "ok" : "err",
        latencyMs,
        latestCommit: commits[0] ? { sha: commits[0].sha, message: commits[0].message, ts: commits[0].ts } : null,
        latestDeployment,
        openIssues: gh.isConfigured() ? issues.length : null,
        openPRs: gh.isConfigured() ? prs.length : null,
      };
    }),
  );
  return json({ projects });
};
