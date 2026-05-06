/**
 * GET /api/public/health
 *
 * Tiny health endpoint for the lnch.in service itself. Always returns ok
 * unless the D1 binding is missing. Used by the LaunchOps health probe
 * and any external uptime monitor.
 */
import { type Env, json, nowSec } from "../../_lib/env";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let dbOk = false;
  try {
    const r = await env.DB.prepare("SELECT 1 AS one").first<{ one: number }>();
    dbOk = r?.one === 1;
  } catch {
    dbOk = false;
  }
  return json(
    {
      ok: true,
      service: "lnch.in",
      ts: nowSec(),
      version: "phase-1-public-face",
      bindings: {
        db: dbOk,
        kv: typeof env.LAUNCHOPS_KV?.put === "function",
      },
    },
    { headers: { "cache-control": "public, max-age=10, s-maxage=30" } },
  );
};
