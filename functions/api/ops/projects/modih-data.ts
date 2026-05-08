/**
 * GET /api/ops/projects/modih-data
 *
 * Modih-native dashboard payload — every counter/list the Modih operator
 * panel inside lnch.in wants, in one round-trip. Each section carries its
 * own status envelope so a single 404 doesn't blank the whole page.
 *
 * Auth: admin-gated. The MODIH_ADMIN_SECRET is forwarded server-side; the
 * browser never sees it.
 */
import { type Env, json } from "../../../_lib/env";
import { gate } from "../_gate";
import { ModihAdapter } from "../../../_adapters/modih";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;

  const native = await new ModihAdapter(env).native();
  return json(native, { headers: { "cache-control": "private, max-age=15" } });
};
