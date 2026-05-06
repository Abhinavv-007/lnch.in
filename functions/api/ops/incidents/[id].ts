import { type Env, err, json, nowSec } from "../../../_lib/env";
import { gate } from "../_gate";
import { audit } from "../../../_lib/audit";

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const g = await gate(request, env);
  if (g) return g;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return err(400, "bad id");
  const body = (await request.json()) as { status?: "open" | "monitoring" | "resolved"; notes?: string };
  const resolved_at = body.status === "resolved" ? nowSec() : null;
  await env.DB.prepare(
    "UPDATE launchops_incidents SET status = COALESCE(?, status), notes = COALESCE(?, notes), resolved_at = COALESCE(?, resolved_at) WHERE id = ?",
  )
    .bind(body.status ?? null, body.notes ?? null, resolved_at, id)
    .run();
  await audit(env, { actor: "admin", action: "incident.update", target: String(id), request, meta: body });
  return json({ ok: true });
};
