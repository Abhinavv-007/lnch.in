/**
 * Firebase Admin (Auth) adapter — service-account → JWT → access_token →
 * Identity Toolkit / Firebase Management REST.
 *
 * We don't use the Node-only firebase-admin SDK (unavailable on Workers
 * runtime). Instead we sign a JWT with the service account private key using
 * SubtleCrypto and exchange it for an OAuth access token.
 */
import type { Env } from "../_lib/env";

type Creds = { project_id: string; client_email: string; private_key: string };

const PER_PROJECT_KEYS: Record<string, { id: string; email: string; key: string }> = {
  modih: { id: "FIREBASE_MODIH_PROJECT_ID", email: "FIREBASE_MODIH_CLIENT_EMAIL", key: "FIREBASE_MODIH_PRIVATE_KEY" },
  clex: { id: "FIREBASE_CLEX_PROJECT_ID", email: "FIREBASE_CLEX_CLIENT_EMAIL", key: "FIREBASE_CLEX_PRIVATE_KEY" },
  driped: { id: "FIREBASE_DRIPED_PROJECT_ID", email: "FIREBASE_DRIPED_CLIENT_EMAIL", key: "FIREBASE_DRIPED_PRIVATE_KEY" },
  trgt: { id: "FIREBASE_TRGT_PROJECT_ID", email: "FIREBASE_TRGT_CLIENT_EMAIL", key: "FIREBASE_TRGT_PRIVATE_KEY" },
  portfolio: { id: "FIREBASE_PORTFOLIO_PROJECT_ID", email: "FIREBASE_PORTFOLIO_CLIENT_EMAIL", key: "FIREBASE_PORTFOLIO_PRIVATE_KEY" },
  "clex-ai": { id: "FIREBASE_CLEX_AI_PROJECT_ID", email: "FIREBASE_CLEX_AI_CLIENT_EMAIL", key: "FIREBASE_CLEX_AI_PRIVATE_KEY" },
};

function readCreds(env: Env, slug: string): Creds | null {
  const ref = PER_PROJECT_KEYS[slug];
  if (!ref) return null;
  const e = env as unknown as Record<string, string | undefined>;
  const project_id = e[ref.id];
  const client_email = e[ref.email];
  const raw = e[ref.key];
  if (!project_id || !client_email || !raw) return null;
  // Tolerate "\\n" sequences from env-var copy/paste.
  const private_key = raw.replace(/\\n/g, "\n");
  return { project_id, client_email, private_key };
}

export function isConfigured(env: Env, slug?: string) {
  if (slug) return readCreds(env, slug) !== null;
  return Object.keys(PER_PROJECT_KEYS).some((s) => readCreds(env, s) !== null);
}

export function configuredSlugs(env: Env): string[] {
  return Object.keys(PER_PROJECT_KEYS).filter((s) => readCreds(env, s) !== null);
}

export function projectIdFor(env: Env, slug: string): string | undefined {
  return readCreds(env, slug)?.project_id;
}

// ── PEM → CryptoKey ─────────────────────────────────────────────────────────
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const v = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < v.length; i++) s += String.fromCharCode(v[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const TOKEN_CACHE = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(creds: Creds): Promise<string> {
  const cached = TOKEN_CACHE.get(creds.client_email);
  if (cached && cached.expiresAt - Date.now() / 1000 > 60) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 60 * 60,
  };
  const enc = (o: object) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const key = await importPrivateKey(creds.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64u(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Firebase token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const tok = (await res.json()) as { access_token: string; expires_in: number };
  TOKEN_CACHE.set(creds.client_email, { token: tok.access_token, expiresAt: now + tok.expires_in });
  return tok.access_token;
}

export async function getUserCount(env: Env, slug: string): Promise<{ projectId: string; userCount: number | null; reason?: string }> {
  const creds = readCreds(env, slug);
  if (!creds) return { projectId: "", userCount: null, reason: "not configured" };
  try {
    const token = await getAccessToken(creds);
    // The Identity Toolkit accountInfo:query endpoint reports an exact user
    // count when called with returnUserInfo=false.
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${creds.project_id}/accounts:query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ returnUserInfo: false }),
      },
    );
    if (!res.ok) {
      return { projectId: creds.project_id, userCount: null, reason: `${res.status}` };
    }
    const data = (await res.json()) as { recordsCount?: string | number };
    const count = data.recordsCount != null ? Number(data.recordsCount) : null;
    return { projectId: creds.project_id, userCount: Number.isFinite(count) ? count : null };
  } catch (e) {
    return { projectId: creds.project_id, userCount: null, reason: e instanceof Error ? e.message : "error" };
  }
}
