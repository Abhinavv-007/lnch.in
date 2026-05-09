/**
 * GET / POST / PATCH /api/ops/incidents
 *
 * LaunchOps-side incident log. Mirrors `tasks.ts` / `notes.ts` so the
 * project-detail page can render a project's incident history under a
 * single, consistent endpoint. Schema lives in 0001_init_launchops.sql.
 */
import { type Env, err, json, nowSec } from "../../_lib/env";
import { gate } from "./_gate";
import { audit } from "../../_lib/audit";

const SEVERITIES = new Set(["minor", "major", "critical"]);
const STATUSES = new Set(["open", "monitoring", "resolved"]);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const url = new URL(request.url);
  const project = url.searchParams.get("project");
  const status = url.searchParams.get("status");
  const where: string[] = [];
  const binds: unknown[] = [];
  if (project) {
    where.push("project_slug = ?");
    binds.push(project);
  }
  if (status) {
    where.push("status = ?");
    binds.push(status);
  }
  const sql = `SELECT * FROM launchops_incidents ${
    where.length ? "WHERE " + where.join(" AND ") : ""
  } ORDER BY opened_at DESC LIMIT 200`;
  const r = await env.DB.prepare(sql)
    .bind(...binds)
    .all();
  return json({ incidents: r.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const body = (await request.json()) as {
    project_slug?: string | null;
    title?: string;
    severity?: string;
    status?: string;
    notes?: string;
  };
  if (!body.title) return err(400, "title required");
  const sev = SEVERITIES.has(String(body.severity ?? "")) ? String(body.severity) : "minor";
  const status = STATUSES.has(String(body.status ?? "")) ? String(body.status) : "open";
  const ts = nowSec();
  const r = await env.DB.prepare(
    "INSERT INTO launchops_incidents (project_slug, title, severity, status, notes, opened_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
  )
    .bind(
      body.project_slug ?? null,
      body.title,
      sev,
      status,
      body.notes ?? null,
      ts,
      status === "resolved" ? ts : null,
    )
    .first<{ id: number }>();
  await audit(env, {
    actor: "admin",
    action: "incident.open",
    target: String(r?.id ?? ""),
    request,
    meta: { severity: sev, status, project: body.project_slug ?? null },
  });
  return json({ ok: true, id: r?.id });
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const body = (await request.json()) as {
    id?: number;
    status?: string;
    notes?: string | null;
  };
  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) return err(400, "id required");
  if (!STATUSES.has(String(body.status ?? ""))) {
    return err(400, "status must be open|monitoring|resolved");
  }
  const status = String(body.status);
  const ts = nowSec();
  await env.DB.prepare(
    "UPDATE launchops_incidents SET status = ?, notes = COALESCE(?, notes), resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_at END WHERE id = ?",
  )
    .bind(status, body.notes ?? null, status, ts, id)
    .run();
  await audit(env, {
    actor: "admin",
    action: "incident.update",
    target: String(id),
    request,
    meta: { status },
  });
  return json({ ok: true });
};
