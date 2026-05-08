/**
 * GET /api/ops/public-traffic
 *
 * Time-bucketed public-API traffic for the /ops "APIs" page graphs. Returns
 * one bucket per hour over the requested window with counts per status class
 * (ok / blocked / error) so the chart can stack them without the client
 * having to re-aggregate.
 *
 * Auth: admin only. Cache: 15s private (the data updates as the table
 * receives new rows; we don't want CDN caching here).
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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;

  const url = new URL(request.url);
  const hours = Math.max(1, Math.min(720, num(url.searchParams.get("hours"), 168)));
  const slugFilter = url.searchParams.get("slug")?.trim() || null;

  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - hours * 3600;
  const where = slugFilter
    ? "WHERE ts >= ? AND project_slug = ?"
    : "WHERE ts >= ?";
  const bindings: (string | number)[] = slugFilter ? [fromTs, slugFilter] : [fromTs];

  try {
    const r = await env.DB.prepare(
      `SELECT (ts / 3600) AS bucket,
              COUNT(*) AS calls,
              SUM(CASE WHEN status = 429 THEN 1 ELSE 0 END) AS blocked,
              SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS errors
         FROM launchops_public_audit
         ${where}
        GROUP BY bucket
        ORDER BY bucket ASC`,
    )
      .bind(...bindings)
      .all<Row>();

    const buckets = (r.results ?? []).map((row) => ({
      ts: asInt(row.bucket) * 3600,
      calls: asInt(row.calls),
      blocked: asInt(row.blocked),
      errors: asInt(row.errors),
    }));

    return json(
      {
        window: { hours, fromTs, toTs: now },
        buckets,
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
        buckets: [],
        note: "public_audit table not yet populated or query failed",
        detail: String(e),
      },
      { headers: { "cache-control": "no-store" } },
    );
  }
};
