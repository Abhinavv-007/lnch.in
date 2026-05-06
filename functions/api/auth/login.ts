/**
 * POST /api/auth/login
 * body: { secret: string }
 *
 * Verifies LAUNCHOPS_ADMIN_SECRET and creates a session in KV. Sets the
 * HttpOnly admin_session cookie. Audits both successes and failures.
 */
import { type Env, err, json, setSessionCookie, timingSafeEqual } from "../../_lib/env";
import { audit } from "../../_lib/audit";
import { createSession, nowSec } from "../../_lib/auth";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.LAUNCHOPS_ADMIN_SECRET) {
    await audit(env, { action: "auth.login.misconfigured", request });
    return err(503, "LAUNCHOPS_ADMIN_SECRET not configured");
  }
  let body: { secret?: string };
  try {
    body = (await request.json()) as { secret?: string };
  } catch {
    return err(400, "invalid body");
  }
  const provided = (body.secret ?? "").toString();
  if (!provided) return err(400, "secret required");

  // Rate-limit by IP — 5 failures / 5 minutes.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const rlKey = `rl:auth:${ip}`;
  const rlRaw = await env.LAUNCHOPS_KV.get(rlKey);
  const rl = rlRaw ? Number(rlRaw) : 0;
  if (rl >= 5) {
    await audit(env, { action: "auth.login.rate_limited", request, meta: { ip } });
    return err(429, "too many attempts");
  }

  if (!timingSafeEqual(provided, env.LAUNCHOPS_ADMIN_SECRET)) {
    await env.LAUNCHOPS_KV.put(rlKey, String(rl + 1), { expirationTtl: 300 });
    await audit(env, { action: "auth.login.fail", request, meta: { ip } });
    return err(401, "invalid secret");
  }

  const token = await createSession(env, { user: "admin", via: "secret", createdAt: nowSec() });
  await audit(env, { actor: "admin", action: "auth.login.ok", request, meta: { via: "secret" } });
  return json(
    { ok: true },
    {
      headers: { "set-cookie": setSessionCookie(token, { secure: !ip.startsWith("127.") && ip !== "unknown" }) },
    },
  );
};
