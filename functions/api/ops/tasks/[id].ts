import { type Env, err, json, nowSec } from "../../../_lib/env";
import { gate } from "../_gate";
import { audit } from "../../../_lib/audit";

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const g = await gate(request, env);
  if (g) return g;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return err(400, "bad id");
  const body = (await request.json()) as { title?: string; body?: string; status?: string; priority?: number; tags?: string };
  await env.DB.prepare(
    "UPDATE launchops_tasks SET title = COALESCE(?, title), body = COALESCE(?, body), status = COALESCE(?, status), priority = COALESCE(?, priority), tags = COALESCE(?, tags), updated_at = ? WHERE id = ?",
  )
    .bind(body.title ?? null, body.body ?? null, body.status ?? null, body.priority ?? null, body.tags ?? null, nowSec(), id)
    .run();
  await audit(env, { actor: "admin", action: "task.update", target: String(id), request, meta: body });
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const g = await gate(request, env);
  if (g) return g;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return err(400, "bad id");
  await env.DB.prepare("DELETE FROM launchops_tasks WHERE id = ?").bind(id).run();
  await audit(env, { actor: "admin", action: "task.delete", target: String(id), request });
  return json({ ok: true });
};
