/**
 * GET /api/ops/projects/portfolio-data
 *
 * Composite endpoint that returns everything the Portfolio tab in /ops
 * wants to render in one round-trip: summary, projects, certifications,
 * research, notes. All fetched from https://abhnv.in/api/* via the
 * KV-cached PortfolioAdapter (60s TTL).
 *
 * Auth: admin-gated (same as the rest of /api/ops/*).
 *
 * The endpoint is named `portfolio-data` rather than nested under the
 * project slug (`portfolio/data`) because the portfolio project's slug is
 * already routed through `[slug].ts` and `[slug]/admin/[topic].ts`. Adding
 * a dedicated file here keeps the Portfolio-specific shape out of the
 * generic per-slug aggregator.
 */
import { type Env, json } from "../../../_lib/env";
import { gate } from "../_gate";
import { PortfolioAdapter } from "../../../_adapters/portfolio";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;

  const adapter = new PortfolioAdapter(env);

  const [summary, projects, certifications, research, notes] = await Promise.all([
    adapter.summary(),
    adapter.projects(),
    adapter.certifications(),
    adapter.research(),
    adapter.notes(),
  ]);

  return json(
    {
      base: "https://abhnv.in/api",
      fetchedAt: Math.floor(Date.now() / 1000),
      summary: summary.ok ? summary.data : null,
      summaryError: summary.ok ? null : { status: summary.status, reason: summary.reason },
      projects: projects.ok ? projects.data : [],
      projectsError: projects.ok ? null : { status: projects.status, reason: projects.reason },
      certifications: certifications.ok ? certifications.data : [],
      certificationsError: certifications.ok
        ? null
        : { status: certifications.status, reason: certifications.reason },
      research: research.ok ? research.data : [],
      researchError: research.ok ? null : { status: research.status, reason: research.reason },
      notes: notes.ok ? notes.data : [],
      notesError: notes.ok ? null : { status: notes.status, reason: notes.reason },
    },
    {
      // KV-cached upstream + private to operator session — keep CDN out of
      // it so the operator never sees stale data after a Portfolio redeploy.
      headers: { "cache-control": "private, max-age=15" },
    },
  );
};
