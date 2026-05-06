/**
 * Session management for LaunchOps.
 *
 * Sessions live in KV (`sess:<token>` → JSON). The HttpOnly admin_session
 * cookie carries only the opaque token. We invalidate by deleting the key.
 */
import { type Env, getCookie, json, nowSec } from "./env";
import { audit } from "./audit";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export type Session = {
  user: string;
  via: "secret" | "passkey";
  createdAt: number;
};

export async function getSession(request: Request, env: Env): Promise<Session | null> {
  const token = getCookie(request, "admin_session");
  if (!token) return null;
  const raw = await env.LAUNCHOPS_KV.get(`sess:${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function createSession(env: Env, session: Session): Promise<string> {
  const token = newToken();
  await env.LAUNCHOPS_KV.put(`sess:${token}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return token;
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = getCookie(request, "admin_session");
  if (token) await env.LAUNCHOPS_KV.delete(`sess:${token}`);
}

export async function requireAdmin(
  request: Request,
  env: Env,
): Promise<Session | Response> {
  const session = await getSession(request, env);
  if (!session) {
    await audit(env, {
      actor: "anonymous",
      action: "auth.gate.deny",
      target: new URL(request.url).pathname,
      request,
    });
    return json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return session;
}

function newToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export { nowSec };
