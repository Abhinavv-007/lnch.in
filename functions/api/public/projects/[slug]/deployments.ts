/**
 * GET /api/public/projects/:slug/deployments
 *
 * Public mirror of recent deployments for a project. Pulls from Cloudflare
 * Pages and Vercel using whatever creds are configured server-side. Strips
 * everything except the public-safe fields (project, state, sha, ts, url).
 *
 * If neither provider has a deployment matching this project's slug or repo
 * we return `available: false` and an honest empty state — never fabricate.
 */
import { type Env, err, json, nowSec } from "../../../../_lib/env";
import { PROJECT_BY_SLUG } from "../../../../_lib/projects";
import { CloudflareAdapter } from "../../../../_adapters/cloudflare";
import { VercelAdapter } from "../../../../_adapters/vercel";

type PublicDeployment = {
  source: "cloudflare" | "vercel";
  project: string;
  state: string;
  sha: string | null;
  ts: number;
  url?: string | null;
  target?: string | null;
};

function matchesProject(slug: string, candidateProject: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const a = norm(slug);
  const b = norm(candidateProject);
  return a === b || b.includes(a) || a.includes(b);
}

export const onRequestGet: PagesFunction<Env, "slug"> = async ({ env, params }) => {
  const slug = String(params?.slug ?? "");
  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "project not found");

  const cf = new CloudflareAdapter(env);
  const vc = new VercelAdapter(env);
  const sources: string[] = [];
  const out: PublicDeployment[] = [];

  if (cf.isConfigured()) {
    sources.push("cloudflare");
    try {
      const projects = await cf.listPagesProjects();
      const matched = projects.filter((p) => matchesProject(slug, p.name));
      await Promise.all(
        matched.slice(0, 4).map(async (p) => {
          const recent = await cf.listPagesDeployments(p.name).catch(() => []);
          for (const r of recent) {
            const stage = (r as { latest_stage?: { status?: string } }).latest_stage;
            const state = stage?.status === "success" ? "ready" : (stage?.status ?? "queued");
            const trigger = (r as { deployment_trigger?: { metadata?: { commit_hash?: string } } }).deployment_trigger;
            out.push({
              source: "cloudflare",
              project: p.name,
              state,
              sha: trigger?.metadata?.commit_hash ?? null,
              ts: Date.parse((r as { created_on: string }).created_on),
              url: (r as { url?: string }).url ?? null,
            });
          }
        }),
      );
    } catch {
      /* swallow — we degrade to the other source */
    }
  }

  if (vc.isConfigured()) {
    sources.push("vercel");
    try {
      const list = await vc.listRecentDeployments(50);
      for (const d of list) {
        const dep = d as {
          name?: string;
          state?: string;
          meta?: { githubCommitSha?: string };
          createdAt?: number;
          url?: string;
          target?: string;
        };
        if (dep.name && matchesProject(slug, dep.name)) {
          out.push({
            source: "vercel",
            project: dep.name,
            state: dep.state?.toLowerCase() ?? "unknown",
            sha: dep.meta?.githubCommitSha ?? null,
            ts: dep.createdAt ?? 0,
            url: dep.url ?? null,
            target: dep.target ?? null,
          });
        }
      }
    } catch {
      /* swallow */
    }
  }

  out.sort((a, b) => b.ts - a.ts);
  const trimmed = out.slice(0, 30);
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const last24h = trimmed.filter((d) => d.ts >= dayAgo);
  const failed = trimmed.filter((d) => /error|failure|failed|cancel/i.test(d.state)).length;

  return json(
    {
      slug: project.slug,
      generatedAt: nowSec(),
      available: trimmed.length > 0,
      sources,
      deployments: trimmed,
      counts: {
        last24h: last24h.length,
        failed,
        total: trimmed.length,
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
};
