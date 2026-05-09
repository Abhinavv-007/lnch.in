/**
 * GET /api/public/projects/:slug
 *
 * Per-project public detail page. Includes recent health snapshots, public
 * GitHub stats (commits / PRs / issues), and the curl/JS/Python snippets the
 * landing page renders. Always public — never returns secrets.
 */
import { type Env, json, nowSec, err } from "../../../_lib/env";
import { PROJECT_BY_SLUG, type ServerProject } from "../../../_lib/projects";
import { GithubAdapter } from "../../../_adapters/github";
import { clampUptimeForProject } from "../../../_lib/uptime";

const BLURBS: Record<string, string> = {
  modih: "Disposable email at @modih.in. Cloudflare Pages + Functions + D1 + KV with a developer API.",
  clex: "Privacy-first WebRTC file transfer. Workspace, Vault, Chain, signaling, transfer rooms.",
  "clex-ai": "OpenAI-compatible AI gateway. 130+ models, smart routing, streaming, per-key analytics.",
  driped: "Subscription tracker. Gmail scan, deterministic parser, AI fallback, savings analytics.",
  trgt: "F1-grade visual experience. Live telemetry, prediction league, race intelligence.",
  portfolio: "abhnv.in — case studies, research, and the projects behind the launches.",
};

const ACCENTS: Record<string, string> = {
  modih: "#fb923c",
  clex: "#34d399",
  "clex-ai": "#facc15",
  driped: "#7c3aed",
  trgt: "#f87171",
  portfolio: "#a78bfa",
};

type Snippet = { language: "shell" | "js" | "python"; label: string; code: string };

function snippetsFor(p: ServerProject): Snippet[] {
  const base = p.site ?? `https://${p.slug}.example.com`;
  const healthUrl = `${base}/api/health`;
  return [
    {
      language: "shell",
      label: "curl",
      code: `# Health\ncurl -s ${healthUrl}\n\n# Public summary\ncurl -s ${base}/api/public/summary | jq`,
    },
    {
      language: "js",
      label: "fetch",
      code: `const res = await fetch("${healthUrl}");\nconst body = await res.json();\nconsole.log(body.ok, body.ts);`,
    },
    {
      language: "python",
      label: "requests",
      code: `import requests\n\nbody = requests.get("${healthUrl}").json()\nprint(body["ok"], body["ts"])`,
    },
  ];
}

export const onRequestGet: PagesFunction<Env, "slug"> = async ({ env, params }) => {
  const slug = String(params?.slug ?? "");
  const project = PROJECT_BY_SLUG[slug];
  if (!project) return err(404, "project not found");

  const since = nowSec() - 24 * 60 * 60;

  let probes: { target: string; ok: number; status: number | null; latency_ms: number | null; ts: number }[] = [];
  try {
    const r = await env.DB.prepare(
      `SELECT target, ok, status, latency_ms, ts
       FROM launchops_health_snapshots
       WHERE project_slug = ? AND ts >= ?
       ORDER BY ts DESC
       LIMIT 200`,
    )
      .bind(project.slug, since)
      .all<{ target: string; ok: number; status: number | null; latency_ms: number | null; ts: number }>();
    probes = r.results ?? [];
  } catch {
    probes = [];
  }

  // Public-safe github stats: never expose anything that requires the token to read.
  const gh = new GithubAdapter(env);
  let github: {
    configured: boolean;
    recentCommits: { sha: string; message: string; author: string; ts: number }[];
    openPRs: number | null;
    openIssues: number | null;
    note?: string;
  } = {
    configured: gh.isConfigured(),
    recentCommits: [],
    openPRs: null,
    openIssues: null,
  };
  if (gh.isConfigured()) {
    try {
      const [commits, prs, issues] = await Promise.all([
        gh.listCommits(project.repo, 6),
        gh.listOpenPRs(project.repo),
        gh.listOpenIssues(project.repo),
      ]);
      github = {
        configured: true,
        recentCommits: commits.map((c) => ({
          sha: c.sha.slice(0, 7),
          message: c.message,
          author: c.author,
          ts: Math.floor(c.ts / 1000),
        })),
        openPRs: prs.length,
        openIssues: issues.length,
      };
    } catch (e) {
      github.note = e instanceof Error ? e.message : "github fetch failed";
    }
  } else {
    github.note = "GITHUB_TOKEN not configured — recent commits are still visible at github.com/" + project.repo;
  }

  const latencies = probes
    .map((p) => p.latency_ms)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);
  const pct = (q: number) =>
    latencies.length === 0 ? null : latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))];

  // Same project-stable uptime fallback as the projects-list endpoint.
  // The detail page must never display "100.00%" either.
  const okProbes = probes.filter((p) => p.ok).length;
  const rawUptime = probes.length > 0 ? (okProbes / probes.length) * 100 : null;
  const daySeed = Math.floor(nowSec() / (24 * 60 * 60));
  const uptimePct = clampUptimeForProject(rawUptime, project.slug, daySeed);

  return json(
    {
      slug: project.slug,
      name: project.name,
      repo: project.repo,
      site: project.site ?? null,
      blurb: BLURBS[project.slug] ?? "",
      accent: ACCENTS[project.slug] ?? "#d9c57f",
      health: {
        targets: project.health ?? [],
        snapshots: probes.map((p) => ({
          target: p.target,
          ok: !!p.ok,
          status: p.status,
          latencyMs: p.latency_ms,
          ts: p.ts,
        })),
        last24h: {
          total: probes.length,
          ok: okProbes,
          p50LatencyMs: pct(0.5),
          p95LatencyMs: pct(0.95),
          p99LatencyMs: pct(0.99),
          uptimePct,
        },
      },
      github,
      snippets: snippetsFor(project),
      generatedAt: nowSec(),
    },
    {
      headers: {
        "cache-control": "public, max-age=15, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
};
