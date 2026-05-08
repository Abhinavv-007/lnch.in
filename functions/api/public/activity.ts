/**
 * GET /api/public/activity
 *
 * Public, IP-masked excerpt of recent /api/public/** calls. Pulls from
 * `launchops_public_audit` (the same table that powers the operator
 * `/ops/api` view) and trims everything potentially identifying:
 *
 *   - IP addresses are masked to `prefix.x.x.x` so the surface is honest
 *     about traffic geography without exposing exact addresses
 *   - User-agents are dropped entirely
 *   - Only the normalized endpoint shape is returned (no raw query strings)
 *
 * Powers the public "live activity" feed on the landing.
 */
import { type Env, json, nowSec } from "../../_lib/env";

type Row = {
  ts: number;
  endpoint: string;
  project_slug: string | null;
  status: number;
  latency_ms: number;
  ip: string;
};

function maskIp(ip: string): string {
  if (!ip) return "anon";
  if (ip.includes(":")) {
    // IPv6 — keep the first 2 hextets, mask the rest.
    const parts = ip.split(":");
    return parts.slice(0, 2).join(":") + ":x:x:x:x:x:x";
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return "anon";
  return `${parts[0]}.${parts[1]}.x.x`;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(5, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));

  let rows: Row[] = [];
  try {
    const r = await env.DB.prepare(
      `SELECT ts, endpoint, project_slug, status, latency_ms, ip
       FROM launchops_public_audit
       ORDER BY ts DESC
       LIMIT ?`,
    )
      .bind(limit)
      .all<Row>();
    rows = r.results ?? [];
  } catch {
    /* table may not exist yet */
  }

  const calls = rows.map((r) => ({
    ts: r.ts,
    endpoint: r.endpoint,
    project: r.project_slug,
    status: r.status,
    latencyMs: r.latency_ms,
    // Masked IP only — never the exact address.
    ip: maskIp(r.ip),
  }));

  // Aggregate counts for the bottom strip of the activity poster.
  const since = nowSec() - 60 * 60;
  let lastHour = 0;
  let okCount = 0;
  for (const r of rows) {
    if (r.ts >= since) lastHour += 1;
    if (r.status >= 200 && r.status < 400) okCount += 1;
  }

  return json(
    {
      generatedAt: nowSec(),
      calls,
      counts: {
        total: rows.length,
        lastHour,
        ok: okCount,
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=15, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
};
