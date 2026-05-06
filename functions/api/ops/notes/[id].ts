import { type Env, err, json, nowSec } from "../../../_lib/env";
import { gate } from "../_gate";
import { audit } from "../../../_lib/audit";

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const g = await gate(request, env);
  if (g) return g;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return err(400, "bad id");
  const body = (await request.json()) as { title?: string; body?: string; tags?: string };
  await env.DB.prepare("UPDATE launchops_notes SET title = COALESCE(?, title), body = COALESCE(?, body), tags = COALESCE(?, tags), updated_at = ? WHERE id = ?")
    .bind(body.title ?? null, body.body ?? null, body.tags ?? null, nowSec(), id)
    .run();
  await audit(env, { actor: "admin", action: "note.update", target: String(id), request });
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const g = await gate(request, env);
  if (g) return g;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return err(400, "bad id");
  await env.DB.prepare("DELETE FROM launchops_notes WHERE id = ?").bind(id).run();
  await audit(env, { actor: "admin", action: "note.delete", target: String(id), request });
  return json({ ok: true });
};
