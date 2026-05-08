/**
 * Public-API audit logger.
 *
 * Every successful (or rate-limited) call into `/api/public/**` ends up here
 * via `_middleware.ts`. The actual D1 INSERT runs inside `ctx.waitUntil` so the
 * request itself never waits on the audit write — if D1 is slow or down the
 * caller still gets their response on time.
 *
 * Path normalization keeps the `endpoint` column low-cardinality (one row per
 * shape, not per slug) so the /ops grouping is meaningful even when traffic is
 * heavily skewed toward one project.
 *
 * No PII beyond the raw client IP is stored. UAs are clipped to 80 chars to
 * keep the table compact and to avoid accidentally storing sensitive headers.
 */
import type { Env } from "./env";
import { nowSec } from "./env";
import type { RateLimitDecision } from "./rateLimit";

const PROJECT_SLUG_RX = /^\/api\/public\/projects\/([^/]+)(.*)$/;

export type NormalizedPath = {
  endpoint: string;
  projectSlug: string | null;
};

/**
 * `/api/public/projects/clex/heatmap` -> `{ endpoint: '/api/public/projects/:slug/heatmap', projectSlug: 'clex' }`
 *
 * For non-project paths the `endpoint` is the raw pathname so /developers,
 * /search, /heatmap (registry-wide), /health, etc. each get their own bucket.
 */
export function normalizePath(pathname: string): NormalizedPath {
  const m = pathname.match(PROJECT_SLUG_RX);
  if (!m) return { endpoint: pathname, projectSlug: null };
  const slug = m[1];
  const tail = m[2] ?? "";
  return { endpoint: `/api/public/projects/:slug${tail}`, projectSlug: slug };
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

function shortUa(request: Request): string | null {
  const ua = request.headers.get("user-agent");
  if (!ua) return null;
  return ua.length > 80 ? ua.slice(0, 80) : ua;
}

export type PublicAuditRecord = {
  request: Request;
  status: number;
  latencyMs: number;
  decision: RateLimitDecision;
};

/**
 * Fire-and-forget INSERT. Returns the promise so callers can hand it to
 * `ctx.waitUntil` (preferred) or fire it independently — never `await` from
 * inside a request handler.
 */
export async function recordPublicCall(env: Env, rec: PublicAuditRecord): Promise<void> {
  if (!env.DB) return;
  try {
    const url = new URL(rec.request.url);
    const { endpoint, projectSlug } = normalizePath(url.pathname);
    await env.DB.prepare(
      `INSERT INTO launchops_public_audit
        (ts, ip, method, path, endpoint, project_slug, status, latency_ms, rl_used, rl_limit, ua_short)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        nowSec(),
        clientIp(rec.request),
        rec.request.method,
        url.pathname,
        endpoint,
        projectSlug,
        rec.status | 0,
        Math.max(0, rec.latencyMs | 0),
        rec.decision.used | 0,
        rec.decision.limit | 0,
        shortUa(rec.request),
      )
      .run();
  } catch {
    // Audit failures are silently swallowed — they must never break the caller.
  }
}

/**
 * Cron-side helper to keep the table from growing forever. Default retention
 * is 30 days which lines up with /ops "last 7 days" + a safety buffer.
 */
export async function prunePublicAudit(env: Env, retentionDays = 30): Promise<number> {
  if (!env.DB) return 0;
  const cutoff = nowSec() - Math.max(1, retentionDays | 0) * 24 * 60 * 60;
  try {
    const r = await env.DB.prepare("DELETE FROM launchops_public_audit WHERE ts < ?").bind(cutoff).run();
    const meta = (r as unknown as { meta?: { changes?: number } }).meta;
    return meta?.changes ?? 0;
  } catch {
    return 0;
  }
}
