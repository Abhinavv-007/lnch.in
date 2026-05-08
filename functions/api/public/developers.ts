/**
 * GET /api/public/developers
 *
 * Machine-readable index of every public lnch.in endpoint. Used by the
 * `/developers` page to render the curl/fetch/python snippets and by anyone
 * scripting against lnch.in who'd rather hit a single discovery endpoint
 * than read this file.
 *
 * Includes the rate-limit budget so consumers can size their own clients
 * without trial-and-error.
 */
import { type Env, json, nowSec } from "../../_lib/env";
import { PROJECTS } from "../../_lib/projects";
import { DEFAULT_DAILY_LIMIT } from "../../_lib/rateLimit";

type Param = {
  name: string;
  required?: boolean;
  description: string;
  example?: string;
  default?: string;
};

type Endpoint = {
  id: string;
  method: "GET";
  path: string;
  summary: string;
  description: string;
  perProject: boolean;
  category: "registry" | "project" | "activity" | "search" | "service";
  params?: Param[];
  exampleSlug?: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    id: "projects-list",
    method: "GET",
    path: "/api/public/projects",
    summary: "List every project + live health",
    description:
      "Public registry combined with the latest health probe and 24h aggregate (latency / uptime / state). Cacheable.",
    perProject: false,
    category: "registry",
  },
  {
    id: "project-detail",
    method: "GET",
    path: "/api/public/projects/:slug",
    summary: "Per-project detail (health + GitHub)",
    description:
      "Project metadata, recent probe snapshots, GitHub stats (commits / open PRs / issues), and copy-paste snippets.",
    perProject: true,
    category: "project",
    exampleSlug: "modih",
  },
  {
    id: "project-uptime",
    method: "GET",
    path: "/api/public/projects/:slug/uptime",
    summary: "24h uptime + p50/p95/p99 latency",
    description: "Aggregated uptime / error rate / latency percentiles for the past 24 hours.",
    perProject: true,
    category: "project",
    exampleSlug: "modih",
  },
  {
    id: "project-analytics",
    method: "GET",
    path: "/api/public/projects/:slug/analytics",
    summary: "Probe analytics across 24h / 7d / 30d",
    description:
      "Sample counts, uptime, p50 / p95 / p99 latency over three rolling windows plus a 7-day daily uptime sparkline. Audit-event count is aggregated to a single number — no per-actor data leaks out.",
    perProject: true,
    category: "project",
    exampleSlug: "modih",
  },
  {
    id: "project-deployments",
    method: "GET",
    path: "/api/public/projects/:slug/deployments",
    summary: "Recent Cloudflare + Vercel deployments",
    description:
      "Public-safe view of recent deployments across both providers, scoped to this project. Returns honest empty state when no provider matches.",
    perProject: true,
    category: "project",
    exampleSlug: "modih",
  },
  {
    id: "project-changelog",
    method: "GET",
    path: "/api/public/projects/:slug/changelog",
    summary: "Published changelog entries",
    description: "Mirror of operator changelog filtered to status='published'. Drafts and archived stay private.",
    perProject: true,
    category: "project",
    exampleSlug: "modih",
  },
  {
    id: "project-tasks",
    method: "GET",
    path: "/api/public/projects/:slug/tasks",
    summary: "Shipped operator tasks",
    description: "Tasks the operator has marked as shipped. Open / blocked / archived stay private.",
    perProject: true,
    category: "project",
    exampleSlug: "modih",
  },
  {
    id: "project-commits",
    method: "GET",
    path: "/api/public/projects/:slug/commits",
    summary: "Recent commits for this project's repo",
    description:
      "Wraps the GitHub API server-side; the token never reaches the browser. KV-cached for 60s to absorb bursts.",
    perProject: true,
    category: "project",
    params: [
      { name: "limit", description: "Number of commits", default: "20", example: "10" },
    ],
    exampleSlug: "modih",
  },
  {
    id: "project-heatmap",
    method: "GET",
    path: "/api/public/projects/:slug/heatmap",
    summary: "7×24 activity heatmap (this project only)",
    description:
      "Per-project day-of-week × hour-of-day grid. Cells are real event counts (probes + audit rows for this slug). Empty grid is honest, not faked.",
    perProject: true,
    category: "project",
    exampleSlug: "modih",
  },
  {
    id: "project-probes-history",
    method: "GET",
    path: "/api/public/projects/:slug/probes-history",
    summary: "Long-term probe time-series (paginated)",
    description:
      "Probe history scoped to one project. Returns ascending points so the response can be piped into a chart directly. Falls back to the snapshot table if the long-term log isn't yet populated.",
    perProject: true,
    category: "project",
    params: [
      { name: "hours", description: "Window length, 1..720", default: "24", example: "168" },
      { name: "target", description: "Filter to one health URL", example: "https://modih.in/api/health" },
      { name: "limit", description: "Row cap, 1..2000", default: "500", example: "1000" },
    ],
    exampleSlug: "modih",
  },
  {
    id: "probes-summary",
    method: "GET",
    path: "/api/public/probes",
    summary: "All projects · last-24h probe stats",
    description:
      "Aggregated 24h probe counts / uptime / p50 / p95 / p99 / latest 30 samples per (project, target).",
    perProject: false,
    category: "activity",
  },
  {
    id: "heatmap-global",
    method: "GET",
    path: "/api/public/heatmap",
    summary: "Global 7×24 activity heatmap",
    description: "Day-of-week × hour-of-day grid across every project. Each cell is a real D1 event count.",
    perProject: false,
    category: "activity",
  },
  {
    id: "github-contributions",
    method: "GET",
    path: "/api/public/github/contributions",
    summary: "GitHub contribution calendar",
    description:
      "53 weeks × 7 days for the configured GitHub login (defaults to Abhinavv-007). KV-cached for ~10 min.",
    perProject: false,
    category: "activity",
    params: [
      { name: "user", description: "Override GitHub login", example: "Abhinavv-007" },
    ],
  },
  {
    id: "commits-feed",
    method: "GET",
    path: "/api/public/commits",
    summary: "Latest commits across every repo",
    description:
      "Most recent commits across the registry, deduped and time-sorted. KV-cached for 60s.",
    perProject: false,
    category: "activity",
  },
  {
    id: "search",
    method: "GET",
    path: "/api/public/search",
    summary: "Cross-project public search",
    description: "Fuzzy search across projects, shipped tasks, published changelog entries, and recent commits.",
    perProject: false,
    category: "search",
    params: [
      { name: "q", required: true, description: "Search term, 2+ chars", example: "modih" },
    ],
  },
  {
    id: "service-health",
    method: "GET",
    path: "/api/public/health",
    summary: "lnch.in service health (no rate-limit budget)",
    description:
      "Tiny status endpoint for external uptime monitors. Excluded from the rate-limit budget so a busy monitor never starves real traffic.",
    perProject: false,
    category: "service",
  },
  {
    id: "developers",
    method: "GET",
    path: "/api/public/developers",
    summary: "This index, machine-readable",
    description: "Use this to discover endpoints, params, and the live rate-limit budget without scraping HTML.",
    perProject: false,
    category: "service",
  },
];

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const projects = PROJECTS.map((p) => ({ slug: p.slug, name: p.name }));

  return json(
    {
      generatedAt: nowSec(),
      origin,
      rateLimit: {
        defaultDailyLimit: DEFAULT_DAILY_LIMIT,
        windowSec: 24 * 60 * 60,
        scope: "per-ip",
        excluded: ["/api/public/health"],
        headers: [
          "x-ratelimit-limit",
          "x-ratelimit-remaining",
          "x-ratelimit-reset",
          "x-ratelimit-window",
          "x-ratelimit-policy",
        ],
        notes:
          "Returns 429 with retry-after when the bucket is exhausted. Counters reset at UTC midnight.",
      },
      projects,
      endpoints: ENDPOINTS,
    },
    {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
};
