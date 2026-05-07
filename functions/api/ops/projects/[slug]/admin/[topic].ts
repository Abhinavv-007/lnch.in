/**
 * GET /api/ops/projects/:slug/admin/:topic
 *
 * Server-side proxy for per-project admin reads. The browser never sees the
 * upstream secret — lnch.in calls each project's admin API with the
 * matching `<SLUG>_ADMIN_SECRET` from Pages env, then relays the JSON.
 *
 * Topics are restricted by an allowlist (kept in sync with
 * `PROJECT_ADMIN_TOPICS` on the client). When the secret or the upstream
 * URL is missing, the response carries `available:false` plus a `needs`
 * list and a reason — the UI renders an honest "Missing Integration"
 * panel rather than fabricating data.
 *
 * Querystring is forwarded verbatim so the panel can paginate / filter
 * without us having to wrap each topic individually.
 */
import { type Env, err, json } from "../../../../../_lib/env";
import { gate } from "../../../_gate";
import { PROJECT_BY_SLUG } from "../../../../../_lib/projects";
import { ProjectAdminAdapter, type TopicResponse } from "../../../../../_adapters/projectAdmin";

const ALLOWED_TOPICS = new Set([
  "users",
  "api-consumers",
  "api-keys",
  "audit",
  "security",
  "analytics",
  "health",
  "settings",
]);

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const g = await gate(request, env);
  if (g) return g;

  const slug = String(params.slug);
  const topic = String(params.topic);
  if (!ALLOWED_TOPICS.has(topic)) return err(400, `unknown topic: ${topic}`);

  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "unknown project");

  const url = new URL(request.url);
  const search = url.search; // includes leading "?" or empty string

  const adapter = new ProjectAdminAdapter(env, project);
  const result: TopicResponse = await adapter.fetchTopic(topic, search);

  return json({
    slug,
    topic,
    ...result,
  });
};
