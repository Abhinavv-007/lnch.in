import { type Env, json } from "../../_lib/env";
import { gate } from "./_gate";
import { VercelAdapter } from "../../_adapters/vercel";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const vc = new VercelAdapter(env);
  if (!vc.isConfigured()) {
    return json({ configured: false, team: null, projects: [], domains: [], recentDeployments: [], reason: "VERCEL_TOKEN missing" });
  }
  const [projects, domains, deployments] = await Promise.all([
    vc.listProjects().catch(() => []),
    vc.listDomains().catch(() => []),
    vc.listRecentDeployments(40).catch(() => []),
  ]);
  return json({
    configured: true,
    team: env.VERCEL_TEAM_ID ? { id: env.VERCEL_TEAM_ID, name: env.VERCEL_TEAM_ID } : null,
    projects: projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      framework: p.framework,
      latestDeployment: p.latestDeployments?.[0] ? { state: p.latestDeployments[0].state?.toLowerCase?.() ?? "unknown", ts: p.latestDeployments[0].createdAt, url: p.latestDeployments[0].url } : null,
    })),
    domains,
    recentDeployments: deployments.map((d: any) => ({
      project: d.name,
      state: d.state?.toLowerCase() ?? "unknown",
      ts: d.createdAt,
      url: d.url,
    })),
  });
};
