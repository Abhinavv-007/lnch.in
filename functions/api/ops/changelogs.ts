import { type Env, err, json, nowSec } from "../../_lib/env";
import { gate } from "./_gate";
import { audit } from "../../_lib/audit";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const r = await env.DB.prepare("SELECT * FROM launchops_changelog_drafts ORDER BY updated_at DESC").all();
  return json({ drafts: r.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const body = (await request.json()) as { project_slug?: string; title?: string; body?: string; status?: string };
  if (!body.project_slug || !body.title || !body.body) return err(400, "project_slug, title, body required");
  const ts = nowSec();
  const r = await env.DB.prepare(
    "INSERT INTO launchops_changelog_drafts (project_slug, title, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
  )
    .bind(body.project_slug, body.title, body.body, body.status ?? "draft", ts, ts)
    .first<{ id: number }>();
  await audit(env, { actor: "admin", action: "changelog.create", target: String(r?.id ?? ""), request });
  return json({ ok: true, id: r?.id });
};
