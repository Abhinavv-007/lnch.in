import type { Env } from "./env";
import { nowSec } from "./env";

export async function audit(
  env: Env,
  ev: {
    actor?: string;
    action: string;
    target?: string;
    request?: Request;
    meta?: unknown;
  },
): Promise<void> {
  try {
    const ip =
      ev.request?.headers.get("cf-connecting-ip") ??
      ev.request?.headers.get("x-forwarded-for") ??
      null;
    await env.DB.prepare(
      "INSERT INTO launchops_audit (ts, actor, action, target, ip, meta) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        nowSec(),
        ev.actor ?? "unknown",
        ev.action,
        ev.target ?? null,
        ip,
        ev.meta ? JSON.stringify(ev.meta) : null,
      )
      .run();
  } catch {
    // Audit failures must not break the primary action; surfacing them via
    // the audit table itself would be circular. Silent here is intentional.
  }
}
