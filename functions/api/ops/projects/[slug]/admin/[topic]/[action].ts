/**
 * POST/DELETE/PATCH /api/ops/projects/:slug/admin/:topic/:action
 *
 * Server-side proxy for **mutating** per-project admin actions. The browser
 * never sees the upstream secret — lnch.in adds it server-side after
 * checking the operator session.
 *
 * Safety model:
 *  - Every action lives in a per-project allowlist below. Any call to a
 *    non-allowlisted (slug, topic, action) is rejected with 400 before we
 *    even talk to the upstream. This is the load-bearing piece — without
 *    the allowlist a malicious or buggy frontend could call arbitrary
 *    upstream paths with the admin secret.
 *  - The proxy only ever issues POST/DELETE/PATCH. Reads stay on the GET
 *    `[topic].ts` proxy.
 *  - The frontend MUST send a confirmation payload (the operator-typed
 *    `{ confirm: <expected_string> }`) and the server checks it. This is
 *    the second guardrail in case a UI button is clicked accidentally.
 *
 * Path mapping:
 *  - The :action segment maps 1:1 to the upstream path under
 *    `/api/admin/<topic>/`. So
 *    `POST /api/ops/projects/modih/admin/users/abc123/suspend`
 *    becomes
 *    `POST https://modih.in/api/admin/users/abc123/suspend`.
 *  - Action segments may contain a single slash so they can address
 *    `:id/action` (e.g. `abc123/suspend`). We URL-decode but do not
 *    normalise away `..` — anything containing `..` is rejected.
 */
import { type Env, err, json } from "../../../../../../_lib/env";
import { gate } from "../../../../_gate";
import { PROJECT_BY_SLUG } from "../../../../../../_lib/projects";
import { ModihAdapter } from "../../../../../../_adapters/modih";

type AllowedAction = {
  /** Upstream HTTP method for this action. */
  method: "POST" | "DELETE" | "PATCH";
  /**
   * Regex that matches the URL-decoded :action segment. Use anchors to
   * pin the start/end. Example: /^[\w-]{4,32}\/suspend$/ matches
   * `abc123/suspend` but not `../suspend`.
   */
  match: RegExp;
  /** Required typed-confirmation string the operator must send. */
  confirm: string;
  /** Human-readable description for audit logs. */
  label: string;
};

const ACTIONS: Record<string, Record<string, AllowedAction[]>> = {
  modih: {
    users: [
      {
        method: "POST",
        match: /^[\w-]{4,64}\/suspend$/,
        confirm: "suspend",
        label: "suspend Modih user",
      },
      {
        method: "POST",
        match: /^[\w-]{4,64}\/unsuspend$/,
        confirm: "unsuspend",
        label: "unsuspend Modih user",
      },
    ],
    "api-keys": [
      {
        method: "DELETE",
        match: /^[\w-]{4,64}$/,
        confirm: "revoke",
        label: "revoke Modih API key",
      },
    ],
    inboxes: [
      {
        method: "DELETE",
        match: /^[\w-]{4,64}$/,
        confirm: "delete",
        label: "delete Modih inbox",
      },
    ],
  },
};

function decodeAction(raw: string): string | null {
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.includes("..")) return null;
    if (decoded.startsWith("/") || decoded.endsWith("/")) return null;
    return decoded;
  } catch {
    return null;
  }
}

async function handle(method: "POST" | "DELETE" | "PATCH", ctx: Parameters<PagesFunction<Env>>[0]): Promise<Response> {
  const { request, env, params } = ctx;
  const g = await gate(request, env);
  if (g) return g;

  const slug = String(params.slug);
  const topic = String(params.topic);
  const rawAction = String(params.action);
  const action = decodeAction(rawAction);
  if (!action) return err(400, "invalid action segment");

  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "unknown project");

  const allowed = ACTIONS[slug]?.[topic];
  if (!allowed) return err(400, `no actions configured for ${slug}/${topic}`);
  const matched = allowed.find((a) => a.method === method && a.match.test(action));
  if (!matched) {
    return err(400, `action not allowlisted: ${method} ${slug}/${topic}/${action}`);
  }

  let body: unknown = null;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    return err(400, "invalid JSON body");
  }

  const confirm = (body && typeof body === "object" && "confirm" in body
    ? (body as { confirm?: string }).confirm
    : undefined) as string | undefined;
  if (confirm !== matched.confirm) {
    return err(400, `confirmation token mismatch — send {"confirm":"${matched.confirm}"} to proceed`);
  }

  // Strip the confirmation key so it isn't forwarded to the upstream.
  const forwarded =
    body && typeof body === "object"
      ? Object.fromEntries(Object.entries(body).filter(([k]) => k !== "confirm"))
      : null;

  if (slug === "modih") {
    const upstreamPath = `/api/admin/${topic}/${action}`;
    const r = await new ModihAdapter(env).actionable(matched.method, upstreamPath, forwarded);
    return json(
      {
        slug,
        topic,
        action,
        label: matched.label,
        ok: r.ok,
        status: r.status,
        reason: r.reason,
        data: r.data,
      },
      { status: r.ok ? 200 : Math.max(400, r.status || 500) },
    );
  }

  // Other projects don't have action support yet — keep the door open
  // (the allowlist would refuse before reaching here, but this is the
  // explicit fallback so the contract is obvious).
  return err(501, `action proxy not implemented for project ${slug}`);
}

export const onRequestPost: PagesFunction<Env> = (ctx) => handle("POST", ctx);
export const onRequestDelete: PagesFunction<Env> = (ctx) => handle("DELETE", ctx);
export const onRequestPatch: PagesFunction<Env> = (ctx) => handle("PATCH", ctx);
