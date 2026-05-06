/**
 * GET /api/ops/health
 * POST /api/ops/health/run
 *
 * Runs (or reads cached) HTTP probes against every project's health URL.
 * Probe results are persisted in launchops_health_snapshots so the API
 * center can graph trends over time once a Cron trigger is added.
 */
import { type Env, json, nowSec } from "../../_lib/env";
import { gate } from "./_gate";
import { PROJECTS } from "../../_lib/projects";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  // Return latest snapshot per (project, target).
  const rows = await env.DB.prepare(
    `SELECT s.project_slug, s.target, s.ok, s.status, s.latency_ms
     FROM launchops_health_snapshots s
     JOIN (
       SELECT project_slug, target, MAX(ts) AS ts
       FROM launchops_health_snapshots
       GROUP BY project_slug, target
     ) latest ON latest.project_slug = s.project_slug AND latest.target = s.target AND latest.ts = s.ts`,
  ).all<{ project_slug: string; target: string; ok: number; status: number | null; latency_ms: number | null }>();
  const probes = (rows.results ?? []).map((r) => ({
    project: r.project_slug,
    target: r.target,
    ok: !!r.ok,
    latencyMs: r.latency_ms,
    status: r.status,
  }));
  return json({ probes });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // /run path is mapped via folder structure; this is also reachable as POST /api/ops/health
  const g = await gate(request, env);
  if (g) return g;
  const probes: { project: string; target: string; ok: boolean; latencyMs: number | null; status: number | null }[] = [];
  await Promise.all(
    PROJECTS.flatMap((p) =>
      (p.health ?? []).map(async (target) => {
        const start = Date.now();
        try {
          const res = await fetch(target, { redirect: "manual" });
          const ok = res.ok || res.status === 405;
          probes.push({ project: p.slug, target, ok, latencyMs: Date.now() - start, status: res.status });
        } catch {
          probes.push({ project: p.slug, target, ok: false, latencyMs: Date.now() - start, status: null });
        }
      }),
    ),
  );
  for (const pr of probes) {
    await env.DB.prepare(
      "INSERT INTO launchops_health_snapshots (project_slug, target, ok, status, latency_ms, ts) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(pr.project, pr.target, pr.ok ? 1 : 0, pr.status, pr.latencyMs, nowSec())
      .run();
  }
  return json({ probes });
};
