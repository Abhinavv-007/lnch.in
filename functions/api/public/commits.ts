/**
 * GET /api/public/commits
 *
 * Recent commits across every repo, deduped and time-sorted. Used by the
 * commit ticker on the public landing. Cached in KV for 60s to avoid hitting
 * the GitHub rate limit on every page load.
 */
import { type Env, json, nowSec } from "../../_lib/env";
import { PROJECTS } from "../../_lib/projects";
import { GithubAdapter } from "../../_adapters/github";

const CACHE_KEY = "public:commits:v1";
const CACHE_TTL_SEC = 60;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const cached = await env.LAUNCHOPS_KV.get(CACHE_KEY);
  if (cached) {
    return new Response(cached, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
      },
    });
  }

  const gh = new GithubAdapter(env);
  if (!gh.isConfigured()) {
    return json(
      {
        commits: [],
        generatedAt: nowSec(),
        note: "GITHUB_TOKEN not configured",
      },
      { headers: { "cache-control": "public, max-age=30" } },
    );
  }

  const settled = await Promise.allSettled(
    PROJECTS.map(async (p) => {
      const commits = await gh.listCommits(p.repo, 6);
      return commits.map((c) => ({
        project: p.slug,
        repo: p.repo,
        sha: c.sha.slice(0, 7),
        message: c.message,
        author: c.author,
        ts: Math.floor(c.ts / 1000),
      }));
    }),
  );

  const commits = settled
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 30);

  const payload = JSON.stringify({ commits, generatedAt: nowSec() });
  await env.LAUNCHOPS_KV.put(CACHE_KEY, payload, { expirationTtl: CACHE_TTL_SEC });
  return new Response(payload, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
    },
  });
};
