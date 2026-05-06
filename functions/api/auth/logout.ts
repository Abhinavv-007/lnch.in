import { type Env, clearSessionCookie, json } from "../../_lib/env";
import { destroySession } from "../../_lib/auth";
import { audit } from "../../_lib/audit";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await destroySession(env, request);
  await audit(env, { actor: "admin", action: "auth.logout.ok", request });
  return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
};
