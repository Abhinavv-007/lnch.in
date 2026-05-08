/**
 * Modih Mail admin adapter.
 *
 * Calls Modih's server-side admin endpoints with MODIH_ADMIN_SECRET.
 * Every call returns a typed shape — when an endpoint isn't shipped yet
 * upstream we surface that honestly in the UI rather than fabricate.
 *
 * The adapter exposes:
 *   - isConfigured()                  Has the lnch.in env got the secret?
 *   - overview()                      Generic admin-shaped snapshot for /ops
 *                                     (matches ProjectAdminAdapter contract).
 *   - native()                        Modih-native dashboard payload
 *                                     (counters + recent + queue + abuse).
 *   - actionable(method, path, body)  Server-side proxy for mutating actions
 *                                     (POST/DELETE/PATCH). The browser never
 *                                     touches the secret.
 */
import type { Env } from "../_lib/env";

const MODIH_BASE = "https://modih.in";

export type ModihActionResult = {
  ok: boolean;
  status: number;
  data?: unknown;
  reason?: string;
};

export type ModihNativeSection<T> = {
  ok: boolean;
  status: number;
  reason?: string;
  data: T | null;
};

export type ModihNative = {
  base: string;
  fetchedAt: number;
  configured: boolean;
  needs: string[];
  fallbackUrl: string;
  users: ModihNativeSection<unknown>;
  inboxes: ModihNativeSection<unknown>;
  emails: ModihNativeSection<unknown>;
  apiKeys: ModihNativeSection<unknown>;
  recentEmails: ModihNativeSection<unknown>;
  recentSignups: ModihNativeSection<unknown>;
  abuse: ModihNativeSection<unknown>;
};

const NATIVE_PATHS = {
  users: "/api/admin/users/summary",
  inboxes: "/api/admin/inboxes/summary",
  emails: "/api/admin/emails/summary",
  apiKeys: "/api/admin/api-keys/summary",
  recentEmails: "/api/admin/emails/recent",
  recentSignups: "/api/admin/users/recent",
  abuse: "/api/admin/abuse/summary",
} as const;

export class ModihAdapter {
  private readonly secret: string | undefined;
  private readonly base = MODIH_BASE;

  constructor(env: Env) {
    this.secret = env.MODIH_ADMIN_SECRET;
  }

  isConfigured(): boolean {
    return Boolean(this.secret);
  }

  private headers(): HeadersInit {
    if (!this.secret) return { accept: "application/json" };
    return {
      accept: "application/json",
      Authorization: `Bearer ${this.secret}`,
      "X-Admin-Secret": this.secret,
    };
  }

  private async getJson<T = unknown>(path: string): Promise<ModihNativeSection<T>> {
    if (!this.secret) {
      return { ok: false, status: 0, reason: "MODIH_ADMIN_SECRET not set", data: null };
    }
    let res: Response;
    try {
      res = await fetch(this.base + path, { headers: this.headers() });
    } catch (e) {
      return { ok: false, status: 0, reason: `fetch failed: ${(e as Error)?.message ?? "unknown"}`, data: null };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        reason: res.status === 404 ? "endpoint not yet shipped on modih.in" : `upstream ${res.status}`,
        data: null,
      };
    }
    try {
      const body = (await res.json()) as T;
      return { ok: true, status: res.status, data: body };
    } catch {
      return { ok: false, status: res.status, reason: "non-JSON response", data: null };
    }
  }

  /** Best-effort overview snapshot. Aggregates whatever Modih exposes. */
  async overview(): Promise<{
    available: boolean;
    needs: string[];
    plannedEndpoints: string[];
    snapshot?: Record<string, number | string | null>;
  }> {
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
    for (const path of [
      "/api/admin/users/summary",
      "/api/admin/inboxes/summary",
      "/api/admin/emails/summary",
    ]) {
      const r = await this.getJson<Record<string, unknown>>(path);
      if (!r.ok || !r.data) continue;
      available = true;
      for (const [k, v] of Object.entries(r.data)) {
        if (typeof v === "number" || typeof v === "string") snapshot[k] = v;
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

  /**
   * Modih-native dashboard payload — fetches the seven counters/lists the
   * Modih operator panel wants, in parallel. Every section reports its own
   * status so a single 404 doesn't blank the whole page.
   */
  async native(): Promise<ModihNative> {
    const fallbackUrl = `${this.base}/admin`;
    if (!this.secret) {
      const empty: ModihNativeSection<unknown> = {
        ok: false,
        status: 0,
        reason: "MODIH_ADMIN_SECRET not set",
        data: null,
      };
      return {
        base: this.base,
        fetchedAt: Math.floor(Date.now() / 1000),
        configured: false,
        needs: ["MODIH_ADMIN_SECRET"],
        fallbackUrl,
        users: empty,
        inboxes: empty,
        emails: empty,
        apiKeys: empty,
        recentEmails: empty,
        recentSignups: empty,
        abuse: empty,
      };
    }

    const [users, inboxes, emails, apiKeys, recentEmails, recentSignups, abuse] = await Promise.all([
      this.getJson(NATIVE_PATHS.users),
      this.getJson(NATIVE_PATHS.inboxes),
      this.getJson(NATIVE_PATHS.emails),
      this.getJson(NATIVE_PATHS.apiKeys),
      this.getJson(NATIVE_PATHS.recentEmails),
      this.getJson(NATIVE_PATHS.recentSignups),
      this.getJson(NATIVE_PATHS.abuse),
    ]);

    const upstreamMissing =
      users.status === 0 ||
      [users, inboxes, emails].every((s) => !s.ok && s.status !== 200);

    return {
      base: this.base,
      fetchedAt: Math.floor(Date.now() / 1000),
      configured: !upstreamMissing,
      needs: upstreamMissing ? ["modih.in admin endpoints"] : [],
      fallbackUrl,
      users,
      inboxes,
      emails,
      apiKeys,
      recentEmails,
      recentSignups,
      abuse,
    };
  }

  /**
   * Server-side proxy for mutating actions. The caller (the action route)
   * is responsible for allowlisting the path; this just adds the secret
   * and relays the request.
   *
   * `path` MUST start with `/api/admin/`. We refuse anything else outright
   * to make sure we never accidentally hit a customer-facing endpoint with
   * the admin secret.
   */
  async actionable(method: string, path: string, body?: unknown): Promise<ModihActionResult> {
    if (!path.startsWith("/api/admin/")) {
      return { ok: false, status: 400, reason: "path must start with /api/admin/" };
    }
    if (!this.secret) {
      return { ok: false, status: 0, reason: "MODIH_ADMIN_SECRET not set" };
    }
    const m = method.toUpperCase();
    if (!["POST", "DELETE", "PATCH"].includes(m)) {
      return { ok: false, status: 405, reason: `method ${m} not allowed for actions` };
    }
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method: m,
        headers: {
          ...this.headers(),
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      return { ok: false, status: 0, reason: `fetch failed: ${(e as Error)?.message ?? "unknown"}` };
    }
    let data: unknown = null;
    const text = await res.text().catch(() => "");
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      reason: res.ok ? undefined : `upstream ${res.status}`,
    };
  }
}
