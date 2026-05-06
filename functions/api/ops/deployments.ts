import { type Env, json } from "../../_lib/env";
import { gate } from "./_gate";
import { CloudflareAdapter } from "../../_adapters/cloudflare";
import { VercelAdapter } from "../../_adapters/vercel";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const cf = new CloudflareAdapter(env);
  const vc = new VercelAdapter(env);

  const cfBlock: { configured: boolean; deployments: any[] } = { configured: cf.isConfigured(), deployments: [] };
  const vcBlock: { configured: boolean; deployments: any[] } = { configured: vc.isConfigured(), deployments: [] };

  if (cf.isConfigured()) {
    const projects = await cf.listPagesProjects().catch(() => []);
    const all: any[] = [];
    await Promise.all(
      projects.slice(0, 10).map(async (p) => {
        const recent = await cf.listPagesDeployments(p.name).catch(() => []);
        for (const r of recent) {
          all.push({
            project: p.name,
            state: r.latest_stage?.status === "success" ? "ready" : (r.latest_stage?.status ?? "queued"),
            sha: r.deployment_trigger?.metadata?.commit_hash,
            ts: Date.parse(r.created_on),
          });
        }
      }),
    );
    cfBlock.deployments = all.sort((a, b) => b.ts - a.ts).slice(0, 30);
  }
  if (vc.isConfigured()) {
    const list = await vc.listRecentDeployments(50).catch(() => []);
    vcBlock.deployments = list.map((d: any) => ({
      project: d.name,
      state: d.state?.toLowerCase() ?? "unknown",
      sha: d.meta?.githubCommitSha,
      ts: d.createdAt,
      url: d.url,
      target: d.target,
    }));
  }

  const all = [...cfBlock.deployments, ...vcBlock.deployments];
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const last24h = all.filter((d) => d.ts >= dayAgo);
  const failed24h = last24h.filter((d) => ["error", "failure", "failed"].includes(d.state)).length;

  return json({
    cloudflare: cfBlock,
    vercel: vcBlock,
    totals: { last24h: last24h.length, failed24h },
  });
};
