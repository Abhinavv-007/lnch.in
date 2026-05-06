import { type Env, json } from "../../_lib/env";
import { gate } from "./_gate";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const r = await env.DB.prepare("SELECT * FROM launchops_audit ORDER BY ts DESC LIMIT 200").all();
  return json({ events: r.results ?? [] });
};
