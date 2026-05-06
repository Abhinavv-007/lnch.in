/**
 * Modih Mail admin adapter.
 *
 * Calls the Modih server-side admin endpoints with MODIH_ADMIN_SECRET.
 * Returns null with reason='not implemented' when the Modih API doesn't yet
 * expose a particular surface — that's surfaced honestly in the UI.
 */
import type { Env } from "../_lib/env";

export class ModihAdapter {
  private secret: string | undefined;
  private base = "https://modih.in";
  constructor(env: Env) {
    this.secret = env.MODIH_ADMIN_SECRET;
  }
  isConfigured() {
    return Boolean(this.secret);
  }
  /** Best-effort overview snapshot. Aggregates whatever Modih exposes. */
  async overview(): Promise<{ available: boolean; needs: string[]; plannedEndpoints: string[]; snapshot?: Record<string, number | string | null> }> {
    const plannedEndpoints = [
      "GET /api/admin/users/summary",
      "GET /api/admin/inboxes/summary",
      "GET /api/admin/emails/summary",
      "GET /api/admin/api-keys/summary",
      "GET /api/admin/audit",
    ];
    if (!this.secret) {
      return { available: false, needs: ["MODIH_ADMIN_SECRET"], plannedEndpoints };
    }
    const snapshot: Record<string, number | string | null> = {};
    let available = false;
    for (const path of ["/api/admin/users/summary", "/api/admin/inboxes/summary", "/api/admin/emails/summary"]) {
      try {
        const res = await fetch(this.base + path, {
          headers: { Authorization: `Bearer ${this.secret}`, "X-Admin-Secret": this.secret },
        });
        if (!res.ok) continue;
        available = true;
        const json = (await res.json()) as Record<string, unknown>;
        for (const [k, v] of Object.entries(json)) {
          if (typeof v === "number" || typeof v === "string") snapshot[k] = v;
        }
      } catch {
        // tolerated — not all endpoints exist yet
      }
    }
    if (!available) {
      return {
        available: false,
        needs: ["modih.in admin endpoints"],
        plannedEndpoints,
      };
    }
    return { available: true, needs: [], plannedEndpoints, snapshot };
  }
}
