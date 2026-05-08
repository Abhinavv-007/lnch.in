/**
 * GET /api/public/projects/:slug/tasks
 *
 * Public mirror of the operator task list filtered to "shipped" entries
 * — work that's been completed and is safe to show to the public. Open /
 * blocked / archived tasks stay private to the operator console.
 */
import { type Env, err, json, nowSec } from "../../../../_lib/env";
import { PROJECT_BY_SLUG } from "../../../../_lib/projects";

type Row = {
  id: number;
  project_slug: string;
  title: string;
  body: string | null;
  status: string;
  priority: number;
  tags: string | null;
  created_at: number;
  updated_at: number;
};

export const onRequestGet: PagesFunction<Env, "slug"> = async ({ env, params }) => {
  const slug = String(params?.slug ?? "");
  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "project not found");

  let rows: Row[] = [];
  try {
    const r = await env.DB.prepare(
      `SELECT id, project_slug, title, body, status, priority, tags, created_at, updated_at
       FROM launchops_tasks
       WHERE project_slug = ? AND status = 'shipped'
       ORDER BY updated_at DESC
       LIMIT 50`,
    )
      .bind(project.slug)
      .all<Row>();
    rows = r.results ?? [];
  } catch {
    rows = [];
  }

  return json(
    {
      slug: project.slug,
      generatedAt: nowSec(),
      shipped: rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        priority: r.priority,
        tags: r.tags ? r.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        shippedAt: r.updated_at,
      })),
    },
    {
      headers: {
        "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
};
