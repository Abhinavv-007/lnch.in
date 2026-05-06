import { type Env, err, json, nowSec } from "../../_lib/env";
import { gate } from "./_gate";
import { audit } from "../../_lib/audit";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const project = url.searchParams.get("project");
  const where: string[] = [];
  const binds: unknown[] = [];
  if (status) {
    where.push("status = ?");
    binds.push(status);
  }
  if (project) {
    where.push("project_slug = ?");
    binds.push(project);
  }
  const sql = `SELECT * FROM launchops_tasks ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY priority ASC, updated_at DESC`;
  const r = await env.DB.prepare(sql).bind(...binds).all();
  return json({ tasks: r.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const body = (await request.json()) as {
    title?: string;
    body?: string;
    project_slug?: string | null;
    priority?: number;
    status?: string;
    tags?: string;
  };
  if (!body.title) return err(400, "title required");
  const ts = nowSec();
  const r = await env.DB.prepare(
    "INSERT INTO launchops_tasks (project_slug, title, body, status, priority, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
  )
    .bind(
      body.project_slug ?? null,
      body.title,
      body.body ?? null,
      body.status ?? "open",
      Number(body.priority ?? 2),
      body.tags ?? null,
      ts,
      ts,
    )
    .first<{ id: number }>();
  await audit(env, { actor: "admin", action: "task.create", target: String(r?.id ?? ""), request });
  return json({ ok: true, id: r?.id });
};
