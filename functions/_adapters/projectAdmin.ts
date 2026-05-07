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
 *
 * Per-tab proxy: `fetchTopic` is the new lower-level call used by
 * `GET /api/ops/projects/:slug/admin/:topic`. It fetches a single upstream
 * admin endpoint and returns a TopicResponse describing exactly why the
 * panel can or can't render — the UI uses that to pick between
 * MissingIntegration, EmptyState, and the data view.
 */
import type { Env } from "../_lib/env";
import type { ServerProject } from "../_lib/projects";

export interface AdminSnapshot {
  available: boolean;
  needs: string[];
  plannedEndpoints: string[];
  snapshot?: Record<string, number | string | null>;
}

/**
 * Result of a per-topic upstream call.
 *
 * `available=false` means the operator should see a "Missing Integration"
 * panel — either because the secret is missing, the upstream URL isn't
 * configured, or the upstream returned a non-2xx status. We always include
 * the planned endpoint and the missing piece (`needs`) so the UI can
 * explain *why* it can't render real data, instead of silently falling
 * back to fakes.
 *
 * `available=true` carries the parsed JSON body in `data` (or null if the
 * upstream returned 204/empty). The upstream is responsible for shaping
 * its own response — we just relay.
 */
export interface TopicResponse {
  available: boolean;
  needs: string[];
  plannedEndpoint: string;
  status?: number;
  reason?: string;
  data?: unknown;
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

  /**
   * Fetch a single upstream admin topic.
   *
   * Returns a TopicResponse describing exactly why the panel can or can't
   * render. Topic strings are passed through verbatim so they map 1:1 to
   * an upstream URL like `${adminBaseUrl}/${topic}`. Querystring is forwarded.
   */
  async fetchTopic(topic: string, search: string = ""): Promise<TopicResponse> {
    const plannedEndpoint = `GET ${this.project.adminBaseUrl ?? "<adminBaseUrl>"}/${topic}${search}`;
    if (!this.project.adminBaseUrl) {
      return {
        available: false,
        needs: ["adminBaseUrl"],
        plannedEndpoint,
        reason: "No upstream admin base URL is registered for this project.",
      };
    }
    const secret = this.env[this.project.adminSecretEnv];
    if (!secret) {
      return {
        available: false,
        needs: [this.project.adminSecretEnv],
        plannedEndpoint,
        reason: `Set the \`${this.project.adminSecretEnv}\` env var on lnch.in to enable this panel.`,
      };
    }

    const url = buildUrl(this.project.adminBaseUrl, topic) + (search ?? "");
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "X-Admin-Secret": secret,
          Authorization: `Bearer ${secret}`,
          accept: "application/json",
        },
      });
    } catch (e) {
      return {
        available: false,
        needs: [`${this.project.adminBaseUrl}`],
        plannedEndpoint,
        reason: `Upstream fetch failed: ${(e as Error)?.message ?? "unknown"}`,
      };
    }

    if (res.status === 404) {
      return {
        available: false,
        needs: [`${plannedEndpoint} (404)`],
        plannedEndpoint,
        status: 404,
        reason:
          "Upstream returned 404 — this topic is not yet shipped on the project's admin API.",
      };
    }
    if (!res.ok) {
      return {
        available: false,
        needs: [`${this.project.adminSecretEnv}`],
        plannedEndpoint,
        status: res.status,
        reason: `Upstream returned ${res.status}. Check the secret and CORS/auth config.`,
      };
    }

    const text = await res.text().catch(() => "");
    if (!text) {
      return { available: true, needs: [], plannedEndpoint, status: res.status, data: null };
    }
    try {
      return {
        available: true,
        needs: [],
        plannedEndpoint,
        status: res.status,
        data: JSON.parse(text),
      };
    } catch {
      // Some upstreams return a plain string. Pass it through.
      return { available: true, needs: [], plannedEndpoint, status: res.status, data: text };
    }
  }
}
