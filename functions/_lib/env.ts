/**
 * Cloudflare Pages Function bindings & environment.
 *
 * Bindings:
 *   - DB             D1 database (LaunchOps)
 *   - LAUNCHOPS_KV   KV namespace (sessions, challenges, rate limits, cache)
 *
 * Secrets (set via Pages > Environment variables or `wrangler secret put`):
 *   - LAUNCHOPS_ADMIN_SECRET
 *   - LAUNCHOPS_RP_ID, LAUNCHOPS_RP_ORIGIN (defaults to request URL)
 *   - GITHUB_TOKEN
 *   - CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ZONE_ID
 *   - VERCEL_TOKEN, VERCEL_TEAM_ID
 *   - MODIH_ADMIN_SECRET
 *   - FIREBASE_<SLUG>_PROJECT_ID, FIREBASE_<SLUG>_CLIENT_EMAIL, FIREBASE_<SLUG>_PRIVATE_KEY
 *     where SLUG ∈ {MODIH, CLEX, CLEX_AI, DRIPED, TRGT, PORTFOLIO}
 *     (private key may have literal "\n" sequences — they're decoded on use.)
 */
export interface Env {
  DB: D1Database;
  LAUNCHOPS_KV: KVNamespace;

  LAUNCHOPS_ADMIN_SECRET?: string;
  LAUNCHOPS_RP_ID?: string;
  LAUNCHOPS_RP_ORIGIN?: string;
  LAUNCHOPS_PUBLIC_NAME?: string;

  GITHUB_TOKEN?: string;

  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;

  VERCEL_TOKEN?: string;
  VERCEL_TEAM_ID?: string;

  MODIH_ADMIN_SECRET?: string;

  FIREBASE_MODIH_PROJECT_ID?: string;
  FIREBASE_MODIH_CLIENT_EMAIL?: string;
  FIREBASE_MODIH_PRIVATE_KEY?: string;

  FIREBASE_CLEX_PROJECT_ID?: string;
  FIREBASE_CLEX_CLIENT_EMAIL?: string;
  FIREBASE_CLEX_PRIVATE_KEY?: string;

  FIREBASE_DRIPED_PROJECT_ID?: string;
  FIREBASE_DRIPED_CLIENT_EMAIL?: string;
  FIREBASE_DRIPED_PRIVATE_KEY?: string;

  FIREBASE_TRGT_PROJECT_ID?: string;
  FIREBASE_TRGT_CLIENT_EMAIL?: string;
  FIREBASE_TRGT_PRIVATE_KEY?: string;

  FIREBASE_PORTFOLIO_PROJECT_ID?: string;
  FIREBASE_PORTFOLIO_CLIENT_EMAIL?: string;
  FIREBASE_PORTFOLIO_PRIVATE_KEY?: string;
}

export function json<T>(data: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

export function err(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error: message, ...extra }, { status });
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function getCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

export function setSessionCookie(token: string, opts: { maxAge?: number; secure?: boolean } = {}): string {
  const secure = opts.secure ?? true;
  const maxAge = opts.maxAge ?? 60 * 60 * 24 * 14; // 14 days
  return [
    `admin_session=${token}`,
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(): string {
  return "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

/**
 * Constant-time string equality. Treats inputs as opaque bytes.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
