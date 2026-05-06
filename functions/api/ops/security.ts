import { type Env, json } from "../../_lib/env";
import { gate } from "./_gate";
import { GithubAdapter } from "../../_adapters/github";
import { CloudflareAdapter } from "../../_adapters/cloudflare";
import { VercelAdapter } from "../../_adapters/vercel";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;

  const required = ["LAUNCHOPS_ADMIN_SECRET"];
  const optional = [
    "GITHUB_TOKEN",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ZONE_ID",
    "VERCEL_TOKEN",
    "VERCEL_TEAM_ID",
    "MODIH_ADMIN_SECRET",
    "FIREBASE_MODIH_PROJECT_ID",
    "FIREBASE_CLEX_PROJECT_ID",
    "FIREBASE_DRIPED_PROJECT_ID",
    "FIREBASE_TRGT_PROJECT_ID",
  ];
  const e = env as unknown as Record<string, string | undefined>;
  const secrets = [
    ...required.map((name) => ({ name, configured: Boolean(e[name]), required: true })),
    ...optional.map((name) => ({ name, configured: Boolean(e[name]), required: false })),
  ];

  const passkeyCount = (await env.DB.prepare("SELECT COUNT(*) as c FROM launchops_passkeys").first<{ c: number }>())?.c ?? 0;
  const latestPasskey = await env.DB.prepare("SELECT created_at, label FROM launchops_passkeys ORDER BY created_at DESC LIMIT 1").first<{ created_at: number; label: string | null }>();

  const failuresRows = await env.DB.prepare(
    "SELECT ts, ip, action FROM launchops_audit WHERE action LIKE 'auth.%fail%' OR action LIKE 'auth.%rate_limited%' OR action LIKE 'passkey.%fail%' OR action LIKE 'passkey.%bad_sig%' ORDER BY ts DESC LIMIT 25",
  ).all<{ ts: number; ip: string | null; action: string }>();
  const recentFailures = (failuresRows.results ?? []).map((r) => ({ ts: r.ts, ip: r.ip ?? "—", via: r.action }));

  const gh = new GithubAdapter(env);
  const cf = new CloudflareAdapter(env);
  const vc = new VercelAdapter(env);
  const [ghH, cfH, vcH] = await Promise.all([
    gh.isConfigured() ? gh.tokenScopeHealth() : Promise.resolve({ ok: false, reason: "not configured" }),
    cf.isConfigured() ? cf.tokenHealth() : Promise.resolve({ ok: false, reason: "not configured" }),
    vc.isConfigured() ? vc.tokenHealth() : Promise.resolve({ ok: false, reason: "not configured" }),
  ]);
  const integrationPermissions = [
    { name: "GitHub token", ok: !!ghH.ok, reason: (ghH as any).reason },
    { name: "Cloudflare token", ok: !!(cfH as any).ok, reason: (cfH as any).reason },
    { name: "Vercel token", ok: !!(vcH as any).ok, reason: (vcH as any).reason },
  ];

  return json({
    secrets,
    passkeys: { count: passkeyCount, latest: latestPasskey ? { ts: latestPasskey.created_at, label: latestPasskey.label ?? "passkey" } : null },
    recentFailures,
    integrationPermissions,
  });
};
