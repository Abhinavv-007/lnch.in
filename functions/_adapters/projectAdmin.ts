/**
 * Generic per-project admin adapter.
 *
 * Each project (clex, clex-ai, driped, trgt) ships its own admin API surface
 * gated by its own `<SLUG>_ADMIN_SECRET`. This adapter calls a small,
 * standard set of endpoints (`/summary`, `/audit`, `/health`) over each
 * project's `adminBaseUrl`, normalises the responses, and returns a snapshot
 * shaped like ModihAdapter so the existing /ops UI surfaces it without
 * special-casing.
 *
 * If the secret isn't configured or every probe 4xx/5xx, we fall back to the
 * "not yet shipped" UI — the user sees an honest "planned" view rather than
 * fabricated numbers.
 */
import type { Env } from "../_lib/env";
import type { ServerProject } from "../_lib/projects";

export interface AdminSnapshot {
  available: boolean;
  needs: string[];
  plannedEndpoints: string[];
  snapshot?: Record<string, number | string | null>;
}

const STANDARD_PATHS = ["/summary", "/audit", "/health"] as const;

function buildUrl(base: string, path: string): string {
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  const tail = path.startsWith("/") ? path : `/${path}`;
  return `${trimmed}${tail}`;
}

function flatten(prefix: string, value: unknown, out: Record<string, number | string | null>) {
  if (value === null || value === undefined) return;
  if (typeof value === "number" || typeof value === "string") {
    out[prefix] = value;
    return;
  }
  if (typeof value === "boolean") {
    out[prefix] = value ? "true" : "false";
    return;
  }
  if (Array.isArray(value)) {
    out[`${prefix}.count`] = value.length;
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${k}` : k;
      // Cap depth to avoid blowing up the snapshot.
      if (next.split(".").length > 3) continue;
      flatten(next, v, out);
    }
  }
}

export class ProjectAdminAdapter {
  constructor(private readonly env: Env, private readonly project: ServerProject) {}

  isConfigured(): boolean {
    const secret = this.env[this.project.adminSecretEnv];
    return Boolean(secret) && Boolean(this.project.adminBaseUrl);
  }

  /**
   * Hit the standard admin probes and merge the responses into a snapshot.
   */
  async overview(): Promise<AdminSnapshot> {
    const plannedEndpoints = STANDARD_PATHS.map(
      (p) => `GET ${this.project.adminBaseUrl ?? "<adminBaseUrl>"}${p}`,
    );
    if (!this.project.adminBaseUrl) {
      return { available: false, needs: ["adminBaseUrl"], plannedEndpoints };
    }
    const secret = this.env[this.project.adminSecretEnv];
    if (!secret) {
      return { available: false, needs: [this.project.adminSecretEnv], plannedEndpoints };
    }

    const snapshot: Record<string, number | string | null> = {};
    let available = false;

    for (const path of STANDARD_PATHS) {
      try {
        const url = buildUrl(this.project.adminBaseUrl, path);
        const res = await fetch(url, {
          headers: {
            "X-Admin-Secret": secret,
            Authorization: `Bearer ${secret}`,
            accept: "application/json",
          },
        });
        if (!res.ok) continue;
        available = true;
        const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (body && typeof body === "object") {
          flatten(path.replace(/^\//, ""), body, snapshot);
        }
      } catch {
        // tolerated — individual probe failure shouldn't fail the panel
      }
    }

    if (!available) {
      return {
        available: false,
        needs: [`${this.project.adminBaseUrl}`],
        plannedEndpoints,
      };
    }
    return { available: true, needs: [], plannedEndpoints, snapshot };
  }
}
