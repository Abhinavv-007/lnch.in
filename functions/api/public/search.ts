/**
 * GET /api/public/search?q=<term>
 *
 * Cross-project public search. Walks four corpora in parallel and returns
 * a single ranked list:
 *
 *   - projects   — match on slug / name / blurb / repo / site host
 *   - tasks      — public-safe (status='shipped') in `launchops_tasks`
 *   - changelog  — public-safe (status='published') in `launchops_changelog_drafts`
 *   - commits    — recent commits across all repos via the GitHub adapter
 *
 * Results are capped per-bucket and per-total to keep the JSON small.
 * Cached for 30s so a typing user doesn't thunder-herd the upstream APIs.
 */
import { type Env, json, nowSec } from "../../_lib/env";
import { PROJECTS } from "../../_lib/projects";
import { GithubAdapter } from "../../_adapters/github";

type Result = {
  kind: "project" | "task" | "changelog" | "commit";
  score: number;
  title: string;
  detail?: string;
  href: string;
  project?: string;
  ts?: number;
};

const PROJECT_BLURBS: Record<string, string> = {
  modih: "Disposable email at @modih.in. Cloudflare Pages + Functions + D1 + KV with a developer API.",
  clex: "Privacy-first WebRTC file transfer. Workspace, Vault, Chain, signaling, transfer rooms.",
  "clex-ai": "OpenAI-compatible AI gateway. 130+ models, smart routing, streaming, per-key analytics.",
  driped: "Subscription tracker. Gmail scan, deterministic parser, AI fallback, savings analytics.",
  trgt: "F1-grade visual experience. Live telemetry, prediction league, race intelligence.",
  portfolio: "abhnv.in — case studies, research, and the projects behind the launches.",
};

function score(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 100;
  if (h.startsWith(n)) return 80;
  if (h.includes(` ${n}`)) return 60;
  if (h.includes(n)) return 40;
  // Loose token match: every needle token must appear in haystack
  const tokens = n.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => h.includes(t))) return 25;
  return 0;
}

function searchProjects(q: string): Result[] {
  return PROJECTS.flatMap<Result>((p) => {
    const blurb = PROJECT_BLURBS[p.slug] ?? "";
    const host = p.site ? new URL(p.site).host : "";
    const candidates = [p.slug, p.name, p.repo, host, blurb].filter(Boolean) as string[];
    const best = Math.max(0, ...candidates.map((c) => score(c, q)));
    if (best === 0) return [];
    return [
      {
        kind: "project",
        score: best,
        title: p.name,
        detail: blurb,
        href: `/projects/${p.slug}`,
        project: p.slug,
      },
    ];
  });
}

async function searchTasks(env: Env, q: string): Promise<Result[]> {
  const like = `%${q.toLowerCase()}%`;
  try {
    const r = await env.DB.prepare(
      `SELECT id, project_slug, title, body, updated_at
       FROM launchops_tasks
       WHERE status = 'shipped'
         AND (LOWER(title) LIKE ? OR LOWER(IFNULL(body, '')) LIKE ?)
       ORDER BY updated_at DESC
       LIMIT 6`,
    )
      .bind(like, like)
      .all<{ id: number; project_slug: string; title: string; body: string | null; updated_at: number }>();
    return (r.results ?? []).map((t) => ({
      kind: "task",
      score: Math.max(score(t.title, q), score(t.body ?? "", q) - 10),
      title: t.title,
      detail: (t.body ?? "").slice(0, 140),
      href: `/projects/${t.project_slug}#task-${t.id}`,
      project: t.project_slug,
      ts: t.updated_at,
    }));
  } catch {
    return [];
  }
}

async function searchChangelog(env: Env, q: string): Promise<Result[]> {
  const like = `%${q.toLowerCase()}%`;
  try {
    const r = await env.DB.prepare(
      `SELECT id, project_slug, title, body, updated_at
       FROM launchops_changelog_drafts
       WHERE status = 'published'
         AND (LOWER(title) LIKE ? OR LOWER(body) LIKE ?)
       ORDER BY updated_at DESC
       LIMIT 6`,
    )
      .bind(like, like)
      .all<{ id: number; project_slug: string; title: string; body: string; updated_at: number }>();
    return (r.results ?? []).map((c) => ({
      kind: "changelog",
      score: Math.max(score(c.title, q), score(c.body, q) - 10),
      title: c.title,
      detail: c.body.slice(0, 140),
      href: `/projects/${c.project_slug}#changelog-${c.id}`,
      project: c.project_slug,
      ts: c.updated_at,
    }));
  } catch {
    return [];
  }
}

async function searchCommits(env: Env, q: string): Promise<Result[]> {
  const gh = new GithubAdapter(env);
  if (!gh.isConfigured()) return [];
  const lists = await Promise.all(
    PROJECTS.map(async (p) => {
      try {
        const list = await gh.listCommits(p.repo, 6);
        return list
          .map((c) => ({ commit: c, project: p }))
          .filter((row) => score(row.commit.message, q) > 0);
      } catch {
        return [];
      }
    }),
  );
  return lists.flat().map(({ commit, project }) => ({
    kind: "commit",
    score: score(commit.message, q),
    title: commit.message.split("\n")[0],
    detail: `${project.name} · ${commit.author}`,
    href: `https://github.com/${project.repo}/commit/${commit.sha}`,
    project: project.slug,
    ts: Math.floor(commit.ts / 1000),
  }));
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return json({ q, results: [], counts: { total: 0 }, generatedAt: nowSec() });
  }

  const [projects, tasks, changelog, commits] = await Promise.all([
    Promise.resolve(searchProjects(q)),
    searchTasks(env, q),
    searchChangelog(env, q),
    searchCommits(env, q),
  ]);

  const all = [...projects, ...tasks, ...changelog, ...commits]
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);

  return json(
    {
      q,
      generatedAt: nowSec(),
      results: all,
      counts: {
        total: all.length,
        projects: projects.length,
        tasks: tasks.length,
        changelog: changelog.length,
        commits: commits.length,
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=15, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
};
