/**
 * POST /api/auth/passkeys
 *
 * One endpoint, multiple actions:
 *   { action: "available" }                       → boolean discovery
 *   { action: "register/begin" }   (admin gated)  → PublicKeyCredentialCreationOptions
 *   { action: "register/finish" }  (admin gated)  → store credential
 *   { action: "login/begin" }                     → PublicKeyCredentialRequestOptions
 *   { action: "login/finish" }                    → verify, set session
 *   { action: "list" }             (admin gated)  → enumerate
 *   { action: "delete", id }       (admin gated)  → revoke
 */
import { type Env, err, json, setSessionCookie } from "../../_lib/env";
import { audit } from "../../_lib/audit";
import { createSession, getSession, nowSec } from "../../_lib/auth";
import {
  b64uToBytes,
  bytesEqual,
  bytesToB64u,
  coseToJwkJson,
  importStoredJwkEs256,
  newChallenge,
  parseAuthData,
  parseClientDataJson,
  resolveRpAndOrigin,
  sha256,
  sha256Of,
  verifyEs256,
  cborDecode,
} from "../../_lib/webauthn";

const CHALLENGE_TTL = 5 * 60; // seconds

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  let body: { action?: string; [k: string]: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return err(400, "invalid body");
  }
  const action = body.action;
  switch (action) {
    case "available":
      return availability(env);
    case "register/begin":
      return registerBegin(request, env);
    case "register/finish":
      return registerFinish(request, env, body);
    case "login/begin":
      return loginBegin(request, env);
    case "login/finish":
      return loginFinish(request, env, body);
    case "list":
      return list(request, env);
    case "delete":
      return remove(request, env, body);
    default:
      return err(400, "unknown action");
  }
};

async function availability(env: Env) {
  const row = await env.DB.prepare("SELECT COUNT(*) as c FROM launchops_passkeys").first<{ c: number }>();
  return json({ ok: true, passkeysAvailable: (row?.c ?? 0) > 0 });
}

async function adminGate(request: Request, env: Env) {
  const s = await getSession(request, env);
  if (!s) return err(401, "unauthorized");
  return null;
}

async function registerBegin(request: Request, env: Env) {
  const gate = await adminGate(request, env);
  if (gate) return gate;
  const { rpId, origin } = resolveRpAndOrigin(request, env);
  const challenge = newChallenge();
  await env.LAUNCHOPS_KV.put(`pk:reg:${challenge}`, JSON.stringify({ origin, rpId }), { expirationTtl: CHALLENGE_TTL });
  const existing = await env.DB.prepare("SELECT cred_id FROM launchops_passkeys WHERE user_id = ?").bind("admin").all<{ cred_id: string }>();
  return json({
    challenge,
    rp: { id: rpId, name: "LaunchOps" },
    user: { id: "admin", name: "admin", displayName: "LaunchOps Admin" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    timeout: 60_000,
    attestation: "none",
    excludeCredentials: (existing.results ?? []).map((r) => ({ id: r.cred_id, type: "public-key" })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
}

async function registerFinish(
  request: Request,
  env: Env,
  body: { credential?: any; label?: string | null; [k: string]: unknown },
) {
  const gate = await adminGate(request, env);
  if (gate) return gate;
  const cred = body.credential;
  if (!cred?.response?.clientDataJSON || !cred?.response?.attestationObject)
    return err(400, "credential missing");
  const { rpId, origin } = resolveRpAndOrigin(request, env);
  const { parsed } = parseClientDataJson(cred.response.clientDataJSON);
  if (parsed.type !== "webauthn.create") return err(400, "wrong type");
  if (parsed.origin !== origin) return err(400, "origin mismatch");
  const stash = await env.LAUNCHOPS_KV.get(`pk:reg:${parsed.challenge}`);
  if (!stash) return err(400, "challenge expired");
  await env.LAUNCHOPS_KV.delete(`pk:reg:${parsed.challenge}`);

  const att = cborDecode(b64uToBytes(cred.response.attestationObject)) as Map<string, unknown>;
  const authData = att.get("authData") as Uint8Array;
  if (!authData) return err(400, "no authData");
  const ad = parseAuthData(authData);
  const expectedRpHash = await sha256Of(rpId);
  if (!bytesEqual(ad.rpIdHash, expectedRpHash)) return err(400, "rpId hash mismatch");
  if (!ad.userPresent) return err(400, "user not present");
  if (!ad.coseKey || !ad.credId) return err(400, "missing attested data");
  const jwk = await coseToJwkJson(ad.coseKey);

  const credId = bytesToB64u(ad.credId);
  await env.DB.prepare(
    "INSERT INTO launchops_passkeys (user_id, cred_id, jwk, sign_count, label, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind("admin", credId, jwk, ad.signCount, body.label ?? null, nowSec())
    .run();
  await audit(env, { actor: "admin", action: "passkey.register.ok", request, meta: { credId, label: body.label ?? null } });
  return json({ ok: true });
}

async function loginBegin(request: Request, env: Env) {
  const { rpId, origin } = resolveRpAndOrigin(request, env);
  const challenge = newChallenge();
  await env.LAUNCHOPS_KV.put(`pk:login:${challenge}`, JSON.stringify({ origin, rpId }), { expirationTtl: CHALLENGE_TTL });
  const list = await env.DB.prepare("SELECT cred_id FROM launchops_passkeys WHERE user_id = ?").bind("admin").all<{ cred_id: string }>();
  return json({
    challenge,
    rpId,
    allowCredentials: (list.results ?? []).map((r) => ({ id: r.cred_id, type: "public-key" })),
    timeout: 60_000,
  });
}

async function loginFinish(
  request: Request,
  env: Env,
  body: { credential?: any; [k: string]: unknown },
) {
  const cred = body.credential;
  if (!cred?.response?.clientDataJSON || !cred?.response?.authenticatorData || !cred?.response?.signature || !cred?.id)
    return err(400, "credential missing");
  const { rpId, origin } = resolveRpAndOrigin(request, env);
  const { parsed } = parseClientDataJson(cred.response.clientDataJSON);
  if (parsed.type !== "webauthn.get") return err(400, "wrong type");
  if (parsed.origin !== origin) return err(400, "origin mismatch");
  const stash = await env.LAUNCHOPS_KV.get(`pk:login:${parsed.challenge}`);
  if (!stash) return err(400, "challenge expired");
  await env.LAUNCHOPS_KV.delete(`pk:login:${parsed.challenge}`);

  const row = await env.DB.prepare("SELECT id, jwk, sign_count FROM launchops_passkeys WHERE cred_id = ?").bind(cred.id).first<{ id: number; jwk: string; sign_count: number }>();
  if (!row) {
    await audit(env, { action: "passkey.login.unknown_cred", request });
    return err(400, "unknown credential");
  }
  const authData = b64uToBytes(cred.response.authenticatorData);
  const ad = parseAuthData(authData);
  const expectedRpHash = await sha256Of(rpId);
  if (!bytesEqual(ad.rpIdHash, expectedRpHash)) return err(400, "rpId hash mismatch");
  if (!ad.userPresent) return err(400, "user not present");
  const clientHash = await sha256(b64uToBytes(cred.response.clientDataJSON));
  const signed = new Uint8Array(authData.length + clientHash.length);
  signed.set(authData, 0);
  signed.set(clientHash, authData.length);
  const pub = await importStoredJwkEs256(row.jwk);
  const ok = await verifyEs256(pub, b64uToBytes(cred.response.signature), signed);
  if (!ok) {
    await audit(env, { action: "passkey.login.bad_sig", request, meta: { credId: cred.id } });
    return err(401, "signature invalid");
  }
  if (ad.signCount && ad.signCount <= row.sign_count) {
    await audit(env, { action: "passkey.login.rolling_back", request, meta: { credId: cred.id, prev: row.sign_count, now: ad.signCount } });
    return err(401, "stale signature counter");
  }
  await env.DB.prepare("UPDATE launchops_passkeys SET sign_count = ?, last_used_at = ? WHERE id = ?")
    .bind(ad.signCount, nowSec(), row.id)
    .run();
  const token = await createSession(env, { user: "admin", via: "passkey", createdAt: nowSec() });
  await audit(env, { actor: "admin", action: "auth.login.ok", request, meta: { via: "passkey" } });
  return json({ ok: true }, { headers: { "set-cookie": setSessionCookie(token) } });
}

async function list(request: Request, env: Env) {
  const gate = await adminGate(request, env);
  if (gate) return gate;
  const r = await env.DB.prepare("SELECT id, label, created_at, last_used_at FROM launchops_passkeys WHERE user_id = ? ORDER BY id DESC")
    .bind("admin")
    .all<{ id: number; label: string | null; created_at: number; last_used_at: number | null }>();
  return json({ ok: true, passkeys: r.results ?? [] });
}

async function remove(request: Request, env: Env, body: { id?: number; [k: string]: unknown }) {
  const gate = await adminGate(request, env);
  if (gate) return gate;
  const id = Number(body.id);
  if (!Number.isFinite(id)) return err(400, "id required");
  await env.DB.prepare("DELETE FROM launchops_passkeys WHERE id = ?").bind(id).run();
  await audit(env, { actor: "admin", action: "passkey.delete", target: String(id), request });
  return json({ ok: true });
}
