import { type Env, err, json, nowSec } from "../../../_lib/env";
import { gate } from "../_gate";
import { audit } from "../../../_lib/audit";

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const g = await gate(request, env);
  if (g) return g;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return err(400, "bad id");
  const body = (await request.json()) as { title?: string; body?: string; status?: string };
  await env.DB.prepare(
    "UPDATE launchops_changelog_drafts SET title = COALESCE(?, title), body = COALESCE(?, body), status = COALESCE(?, status), updated_at = ? WHERE id = ?",
  )
    .bind(body.title ?? null, body.body ?? null, body.status ?? null, nowSec(), id)
    .run();
  await audit(env, { actor: "admin", action: "changelog.update", target: String(id), request });
  return json({ ok: true });
};
