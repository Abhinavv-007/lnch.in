/**
 * GET /api/public/projects
 *
 * Public read-only registry used by the landing page. Combines the static
 * project list with the latest health probe and a small set of public-safe
 * stats. No auth, cacheable.
 */
import { type Env, json, nowSec } from "../../_lib/env";
import { PROJECTS } from "../../_lib/projects";
import { claimProbeSlot, runHealthProbes } from "../../_lib/probes";
import { clampUptimeServer } from "../../_lib/uptime";

// Public-side staleness window. If the freshest probe is older than this we
// kick off a background re-probe so the next reader sees fresh data.
const STALE_AFTER_SEC = 5 * 60;
// We require the freshest probe to be within this window to render a real
// up/down/warn state — anything older falls back to "unknown" so the page
// never displays a stale "DOWN" caused by a transient outage from hours ago.
const FRESH_WINDOW_SEC = 60 * 60;

type ProbeRow = {
  project_slug: string;
  target: string;
  ok: number;
  status: number | null;
  latency_ms: number | null;
  ts: number;
};

const PUBLIC_PROJECTS = PROJECTS.map(({ slug, name, repo, site }) => ({
  slug,
  name,
  repo,
  site,
}));

const PROJECT_BLURBS: Record<string, string> = {
  modih: "Disposable email at @modih.in. Cloudflare Pages + Functions + D1 + KV with a developer API.",
  clex: "Privacy-first WebRTC file transfer. Workspace, Vault, Chain, signaling, transfer rooms.",
  "clex-ai": "OpenAI-compatible AI gateway. 130+ models, smart routing, streaming, per-key analytics.",
  driped: "Subscription tracker. Gmail scan, deterministic parser, AI fallback, savings analytics.",
  trgt: "F1-grade visual experience. Live telemetry, prediction league, race intelligence.",
  portfolio: "abhnv.in — case studies, research, and the projects behind the launches.",
};

const PROJECT_ACCENTS: Record<string, string> = {
  modih: "#fb923c",
  clex: "#34d399",
  "clex-ai": "#facc15",
  driped: "#7c3aed",
  trgt: "#f87171",
  portfolio: "#a78bfa",
};

export const onRequestGet: PagesFunction<Env> = async ({ env, waitUntil }) => {
  const now = nowSec();
  const since = now - 24 * 60 * 60;
  const freshSince = now - FRESH_WINDOW_SEC;

  // Single query: latest probe per (project, target) within the freshness
  // window. Anything older than `FRESH_WINDOW_SEC` is dropped — the project
  // falls back to "unknown" rather than displaying a stale DOWN from hours
  // / days ago.
  let latestRows: ProbeRow[] = [];
  let latencyRows: { project_slug: string; latency_ms: number | null; ok: number }[] = [];
  try {
    const latest = await env.DB.prepare(
      `SELECT s.project_slug, s.target, s.ok, s.status, s.latency_ms, s.ts
       FROM launchops_health_snapshots s
       JOIN (
         SELECT project_slug, target, MAX(ts) AS ts
         FROM launchops_health_snapshots
         WHERE ts >= ?
         GROUP BY project_slug, target
       ) latest
         ON latest.project_slug = s.project_slug
        AND latest.target = s.target
        AND latest.ts = s.ts`,
    )
      .bind(freshSince)
      .all<ProbeRow>();
    latestRows = latest.results ?? [];

    const latency = await env.DB.prepare(
      `SELECT project_slug, latency_ms, ok
       FROM launchops_health_snapshots
       WHERE ts >= ?`,
    )
      .bind(since)
      .all<{ project_slug: string; latency_ms: number | null; ok: number }>();
    latencyRows = latency.results ?? [];
  } catch {
    /* DB not yet migrated — return registry-only */
  }

  // Opportunistic background refresh. If the freshest probe is older than
  // the staleness threshold (or there's no probe at all), kick off a
  // background re-probe so the next visitor sees fresh data. KV-coordinated
  // claim guarantees we don't thunder-herd the upstream health endpoints
  // when the landing page gets a burst of traffic.
  const newest =
    latestRows.length === 0
      ? 0
      : latestRows.reduce((m, r) => (r.ts > m ? r.ts : m), 0);
  const stale = newest === 0 || now - newest > STALE_AFTER_SEC;
  if (stale && typeof waitUntil === "function") {
    waitUntil(
      (async () => {
        const claimed = await claimProbeSlot(env, STALE_AFTER_SEC);
        if (!claimed) return;
        try {
          await runHealthProbes(env, { timeoutMs: 6000 });
        } catch {
          /* swallow — public path must never throw */
        }
      })(),
    );
  }

  const probesBySlug = new Map<string, ProbeRow[]>();
  for (const r of latestRows) {
    const arr = probesBySlug.get(r.project_slug) ?? [];
    arr.push(r);
    probesBySlug.set(r.project_slug, arr);
  }

  const latencyBySlug = new Map<string, { okCount: number; total: number; latencies: number[] }>();
  for (const r of latencyRows) {
    const cur = latencyBySlug.get(r.project_slug) ?? { okCount: 0, total: 0, latencies: [] };
    cur.total += 1;
    if (r.ok) cur.okCount += 1;
    if (typeof r.latency_ms === "number") cur.latencies.push(r.latency_ms);
    latencyBySlug.set(r.project_slug, cur);
  }

  const projects = PUBLIC_PROJECTS.map((p) => {
    const probes = probesBySlug.get(p.slug) ?? [];
    const okCount = probes.filter((x) => x.ok).length;
    const lat = latencyBySlug.get(p.slug);
    const latencies = (lat?.latencies ?? []).slice().sort((a, b) => a - b);
    const p95 =
      latencies.length > 0
        ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]
        : null;
    const rawUptime =
      lat && lat.total > 0 ? (lat.okCount / lat.total) * 100 : null;
    return {
      slug: p.slug,
      name: p.name,
      repo: p.repo,
      site: p.site ?? null,
      blurb: PROJECT_BLURBS[p.slug] ?? "",
      accent: PROJECT_ACCENTS[p.slug] ?? "#d9c57f",
      health: {
        targets: probes.length,
        ok: okCount,
        state:
          probes.length === 0
            ? "unknown"
            : okCount === probes.length
              ? "ok"
              : okCount > 0
                ? "warn"
                : "err",
      },
      latestProbe:
        probes.length > 0
          ? {
              latencyMs: probes[0].latency_ms,
              status: probes[0].status,
              ts: probes[0].ts,
            }
          : null,
      last24h: {
        probes: lat?.total ?? 0,
        ok: lat?.okCount ?? 0,
        p95LatencyMs: p95,
        // Uptime is clamped to [0, 99.99] so the public surface never
        // claims a perfect "100.00%" — Cloudflare's own SLO is 99.99%, so
        // anything we serve via Pages cannot exceed that bound.
        uptimePct: clampUptimeServer(rawUptime),
      },
    };
  });

  return json(
    {
      generatedAt: now,
      projects,
      counts: {
        total: projects.length,
        healthy: projects.filter((p) => p.health.state === "ok").length,
        warning: projects.filter((p) => p.health.state === "warn").length,
        down: projects.filter((p) => p.health.state === "err").length,
        unknown: projects.filter((p) => p.health.state === "unknown").length,
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=15, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
};
