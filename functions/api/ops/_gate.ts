import type { Env } from "../../_lib/env";
import { requireAdmin } from "../../_lib/auth";

export async function gate(request: Request, env: Env) {
  const r = await requireAdmin(request, env);
  if (r instanceof Response) return r;
  return null;
}
