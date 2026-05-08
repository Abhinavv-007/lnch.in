/**
 * GET /api/public/projects/:slug/commits
 *
 * Recent commits for a single project's GitHub repo. Wraps `GithubAdapter`
 * so the GitHub token never reaches the browser. KV-cached per-slug for 60s
 * to absorb landing-page bursts and to keep us under the GitHub rate limit
 * even when the public surface is being scraped.
 *
 * Query params:
 *   - limit  1..50   default 20    number of commits to return
 */
import { type Env, err, json, nowSec } from "../../../../_lib/env";
import { PROJECT_BY_SLUG } from "../../../../_lib/projects";
import { GithubAdapter } from "../../../../_adapters/github";

const CACHE_TTL_SEC = 60;

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw === null ? fallback : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export const onRequestGet: PagesFunction<Env, "slug"> = async ({ env, params, request }) => {
  const slug = String(params?.slug ?? "");
  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "project not found");

  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), 20, 1, 50);

  const cacheKey = `public:project:commits:${project.slug}:${limit}`;
  try {
    const cached = await env.LAUNCHOPS_KV.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
        },
      });
    }
  } catch {
    /* KV miss — fall through to live fetch */
  }

  const gh = new GithubAdapter(env);
  if (!gh.isConfigured()) {
    return json(
      {
        slug: project.slug,
        repo: project.repo,
        configured: false,
        commits: [],
        generatedAt: nowSec(),
        note: "GITHUB_TOKEN not configured — commits visible at https://github.com/" + project.repo,
      },
      { headers: { "cache-control": "public, max-age=30" } },
    );
  }

  let commits: { sha: string; message: string; author: string; ts: number; url: string }[] = [];
  let note: string | undefined;
  try {
    const list = await gh.listCommits(project.repo, limit);
    commits = list.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.message,
      author: c.author,
      ts: Math.floor(c.ts / 1000),
      url: `https://github.com/${project.repo}/commit/${c.sha}`,
    }));
  } catch (e) {
    note = e instanceof Error ? e.message : "github fetch failed";
  }

  const payload = JSON.stringify({
    slug: project.slug,
    repo: project.repo,
    configured: true,
    commits,
    generatedAt: nowSec(),
    note: note ?? null,
  });
  try {
    await env.LAUNCHOPS_KV.put(cacheKey, payload, { expirationTtl: CACHE_TTL_SEC });
  } catch {
    /* KV optional */
  }
  return new Response(payload, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
    },
  });
};
