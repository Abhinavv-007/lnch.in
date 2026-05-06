import { type Env, json } from "../../_lib/env";
import { getSession } from "../../_lib/auth";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const s = await getSession(request, env);
  if (!s) return json({ ok: false }, { status: 401 });
  return json({ ok: true, user: s.user, method: s.via });
};
