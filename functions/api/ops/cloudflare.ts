import { type Env, json } from "../../_lib/env";
import { gate } from "./_gate";
import { CloudflareAdapter } from "../../_adapters/cloudflare";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const cf = new CloudflareAdapter(env);
  if (!cf.isConfigured()) {
    return json({ configured: false, account: null, pagesProjects: [], workers: [], zones: [], d1Databases: [], kvNamespaces: [], reason: "CLOUDFLARE_API_TOKEN/ACCOUNT_ID missing" });
  }
  const [account, pages, workers, zones, d1, kv] = await Promise.all([
    cf.getAccount().catch(() => null),
    cf.listPagesProjects().catch(() => []),
    cf.listWorkers().catch(() => []),
    cf.listZones().catch(() => []),
    cf.listD1().catch(() => []),
    cf.listKv().catch(() => []),
  ]);
  return json({
    configured: true,
    account,
    pagesProjects: pages.map((p: any) => ({
      name: p.name,
      subdomain: p.subdomain,
      latest: p.latest_deployment ? { state: p.latest_deployment.stage ?? "unknown", ts: Date.parse(p.latest_deployment.modified_on ?? "") || 0 } : null,
    })),
    workers: workers.map((w: any) => ({ name: w.id, ts: Date.parse(w.modified_on) })),
    zones,
    d1Databases: d1,
    kvNamespaces: kv,
  });
};
