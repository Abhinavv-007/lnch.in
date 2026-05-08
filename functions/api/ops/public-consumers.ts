/**
 * GET /api/ops/public-consumers
 *
 * Cross-project view of who is hitting the public API surface. Powers the new
 * "Consumers" section under /ops/apis. Authenticated (admin only) — the raw
 * IPs and per-IP usage details must never leak to the public surface.
 *
 * Query params (all optional):
 *   ?hours=  1..720   default 24    — how far back to look
 *   ?limit=  1..100   default 25    — top-N IP rows to return
 *   ?slug=                           — restrict to a single project (clex|...)
 *
 * Response shape:
 *   {
 *     window: { hours, fromTs, toTs },
 *     totals: { calls, ips, blocked, errors },
 *     consumers: [
 *       { ip, calls, blocked, errors, lastSeen, p95LatencyMs,
 *         topEndpoint, topProject, ua }
 *     ],
 *     byProject:  [{ slug, calls, blocked }],
 *     byEndpoint: [{ endpoint, calls, blocked, avgLatencyMs }],
 *     byStatus:   [{ status, calls }]
 *   }
 */
import { type Env, json } from "../../_lib/env";
import { gate } from "./_gate";

type Row = Record<string, unknown>;

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n | 0 : 0;
}

function asStr(v: unknown): string {
  return v == null ? "" : String(v);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;

  const url = new URL(request.url);
  const hours = Math.max(1, Math.min(720, num(url.searchParams.get("hours"), 24)));
  const limit = Math.max(1, Math.min(100, num(url.searchParams.get("limit"), 25)));
  const slugFilter = url.searchParams.get("slug")?.trim() || null;

  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - hours * 3600;

  // Build the WHERE clause once and reuse it (D1 prepared statements use
  // positional params so we keep the binding order tight).
  const whereProj = slugFilter ? "AND project_slug = ?" : "";
  const baseBindings: (string | number)[] = slugFilter ? [fromTs, slugFilter] : [fromTs];

  try {
    const totalsR = await env.DB.prepare(
      `SELECT COUNT(*) AS calls,
              COUNT(DISTINCT ip) AS ips,
              SUM(CASE WHEN status = 429 THEN 1 ELSE 0 END) AS blocked,
              SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS errors
         FROM launchops_public_audit
        WHERE ts >= ? ${whereProj}`,
    )
      .bind(...baseBindings)
      .first<Row>();

    const consumersR = await env.DB.prepare(
      `SELECT ip,
              COUNT(*) AS calls,
              SUM(CASE WHEN status = 429 THEN 1 ELSE 0 END) AS blocked,
              SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS errors,
              MAX(ts) AS last_seen,
              MAX(rl_used) AS rl_peak,
              MAX(rl_limit) AS rl_limit
         FROM launchops_public_audit
        WHERE ts >= ? ${whereProj}
        GROUP BY ip
        ORDER BY calls DESC, last_seen DESC
        LIMIT ?`,
    )
      .bind(...baseBindings, limit)
      .all<Row>();

    // Per-IP enrichments: top endpoint + top project + most recent UA. We
    // could fold these into the main GROUP BY with window functions but D1
    // doesn't speak window funcs reliably yet, so we run a tight follow-up
    // per IP — bounded by `limit` so this is at most 100 extra round-trips.
    const enriched = await Promise.all(
      (consumersR.results ?? []).map(async (c) => {
        const ip = asStr(c.ip);
        const [topEpR, topProjR, latR, uaR] = await Promise.all([
          env.DB.prepare(
            `SELECT endpoint, COUNT(*) AS n
               FROM launchops_public_audit
              WHERE ts >= ? AND ip = ? ${whereProj}
              GROUP BY endpoint ORDER BY n DESC LIMIT 1`,
          )
            .bind(...baseBindings, ip)
            .first<Row>(),
          env.DB.prepare(
            `SELECT project_slug, COUNT(*) AS n
               FROM launchops_public_audit
              WHERE ts >= ? AND ip = ? ${whereProj} AND project_slug IS NOT NULL
              GROUP BY project_slug ORDER BY n DESC LIMIT 1`,
          )
            .bind(...baseBindings, ip)
            .first<Row>(),
          env.DB.prepare(
            `SELECT latency_ms FROM launchops_public_audit
              WHERE ts >= ? AND ip = ? ${whereProj} AND latency_ms IS NOT NULL
              ORDER BY latency_ms ASC`,
          )
            .bind(...baseBindings, ip)
            .all<Row>(),
          env.DB.prepare(
            `SELECT ua_short FROM launchops_public_audit
              WHERE ts >= ? AND ip = ? ${whereProj} AND ua_short IS NOT NULL
              ORDER BY ts DESC LIMIT 1`,
          )
            .bind(...baseBindings, ip)
            .first<Row>(),
        ]);
        const lats = (latR.results ?? [])
          .map((r) => asInt(r.latency_ms))
          .filter((n) => n > 0);
        const p95 = lats.length ? lats[Math.min(lats.length - 1, Math.floor(lats.length * 0.95))] : null;
        return {
          ip,
          calls: asInt(c.calls),
          blocked: asInt(c.blocked),
          errors: asInt(c.errors),
          lastSeen: asInt(c.last_seen),
          rlPeak: asInt(c.rl_peak),
          rlLimit: asInt(c.rl_limit),
          p95LatencyMs: p95,
          topEndpoint: topEpR ? asStr(topEpR.endpoint) : null,
          topProject: topProjR ? asStr(topProjR.project_slug) : null,
          ua: uaR ? asStr(uaR.ua_short) : null,
        };
      }),
    );

    const byProjectR = await env.DB.prepare(
      `SELECT project_slug AS slug,
              COUNT(*) AS calls,
              SUM(CASE WHEN status = 429 THEN 1 ELSE 0 END) AS blocked
         FROM launchops_public_audit
        WHERE ts >= ? ${whereProj} AND project_slug IS NOT NULL
        GROUP BY project_slug
        ORDER BY calls DESC`,
    )
      .bind(...baseBindings)
      .all<Row>();

    const byEndpointR = await env.DB.prepare(
      `SELECT endpoint,
              COUNT(*) AS calls,
              SUM(CASE WHEN status = 429 THEN 1 ELSE 0 END) AS blocked,
              AVG(latency_ms) AS avg_latency_ms
         FROM launchops_public_audit
        WHERE ts >= ? ${whereProj}
        GROUP BY endpoint
        ORDER BY calls DESC
        LIMIT 50`,
    )
      .bind(...baseBindings)
      .all<Row>();

    const byStatusR = await env.DB.prepare(
      `SELECT status, COUNT(*) AS calls
         FROM launchops_public_audit
        WHERE ts >= ? ${whereProj}
        GROUP BY status
        ORDER BY status ASC`,
    )
      .bind(...baseBindings)
      .all<Row>();

    return json(
      {
        window: { hours, fromTs, toTs: now },
        totals: {
          calls: asInt(totalsR?.calls),
          ips: asInt(totalsR?.ips),
          blocked: asInt(totalsR?.blocked),
          errors: asInt(totalsR?.errors),
        },
        consumers: enriched,
        byProject: (byProjectR.results ?? []).map((r) => ({
          slug: asStr(r.slug),
          calls: asInt(r.calls),
          blocked: asInt(r.blocked),
        })),
        byEndpoint: (byEndpointR.results ?? []).map((r) => ({
          endpoint: asStr(r.endpoint),
          calls: asInt(r.calls),
          blocked: asInt(r.blocked),
          avgLatencyMs: r.avg_latency_ms == null ? null : Math.round(Number(r.avg_latency_ms)),
        })),
        byStatus: (byStatusR.results ?? []).map((r) => ({
          status: asInt(r.status),
          calls: asInt(r.calls),
        })),
      },
      {
        headers: {
          "cache-control": "private, max-age=15",
        },
      },
    );
  } catch (e) {
    return json(
      {
        window: { hours, fromTs, toTs: now },
        totals: { calls: 0, ips: 0, blocked: 0, errors: 0 },
        consumers: [],
        byProject: [],
        byEndpoint: [],
        byStatus: [],
        note: "public_audit table not yet populated or query failed",
        detail: String(e),
      },
      { headers: { "cache-control": "no-store" } },
    );
  }
};
