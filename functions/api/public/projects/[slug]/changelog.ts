/**
 * GET /api/public/projects/:slug/changelog
 *
 * Public mirror of `/api/ops/changelogs?project_slug=:slug` filtered to
 * status='published'. Drafts and archived entries are never exposed.
 */
import { type Env, err, json, nowSec } from "../../../../_lib/env";
import { PROJECT_BY_SLUG } from "../../../../_lib/projects";

type Row = {
  id: number;
  project_slug: string;
  title: string;
  body: string;
  status: string;
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
      `SELECT id, project_slug, title, body, status, created_at, updated_at
       FROM launchops_changelog_drafts
       WHERE project_slug = ? AND status = 'published'
       ORDER BY updated_at DESC
       LIMIT 100`,
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
      entries: rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        publishedAt: r.updated_at,
      })),
    },
    {
      headers: {
        "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
};
