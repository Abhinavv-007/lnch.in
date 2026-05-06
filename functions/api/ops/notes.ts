import { type Env, err, json, nowSec } from "../../_lib/env";
import { gate } from "./_gate";
import { audit } from "../../_lib/audit";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const url = new URL(request.url);
  const project = url.searchParams.get("project");
  const stmt = project
    ? env.DB.prepare("SELECT * FROM launchops_notes WHERE project_slug = ? ORDER BY updated_at DESC").bind(project)
    : env.DB.prepare("SELECT * FROM launchops_notes ORDER BY updated_at DESC");
  const r = await stmt.all();
  return json({ notes: r.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const body = (await request.json()) as { title?: string; body?: string; project_slug?: string | null; tags?: string };
  if (!body.title || !body.body) return err(400, "title and body required");
  const ts = nowSec();
  const r = await env.DB.prepare(
    "INSERT INTO launchops_notes (project_slug, title, body, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
  )
    .bind(body.project_slug ?? null, body.title, body.body, body.tags ?? null, ts, ts)
    .first<{ id: number }>();
  await audit(env, { actor: "admin", action: "note.create", target: String(r?.id ?? ""), request });
  return json({ ok: true, id: r?.id });
};
