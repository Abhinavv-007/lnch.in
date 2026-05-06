import { type Env, err, json, nowSec } from "../../_lib/env";
import { gate } from "./_gate";
import { audit } from "../../_lib/audit";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const r = await env.DB.prepare("SELECT * FROM launchops_incidents ORDER BY opened_at DESC").all();
  return json({ incidents: r.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const body = (await request.json()) as { project_slug?: string | null; title?: string; severity?: string; notes?: string };
  if (!body.title) return err(400, "title required");
  const ts = nowSec();
  const r = await env.DB.prepare(
    "INSERT INTO launchops_incidents (project_slug, title, severity, status, notes, opened_at) VALUES (?, ?, ?, 'open', ?, ?) RETURNING id",
  )
    .bind(body.project_slug ?? null, body.title, body.severity ?? "minor", body.notes ?? null, ts)
    .first<{ id: number }>();
  await audit(env, { actor: "admin", action: "incident.open", target: String(r?.id ?? ""), request });
  return json({ ok: true, id: r?.id });
};
