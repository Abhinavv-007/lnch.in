import { type Env, json } from "../../_lib/env";
import { gate } from "./_gate";
import { GithubAdapter } from "../../_adapters/github";
import { PROJECTS } from "../../_lib/projects";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const gh = new GithubAdapter(env);
  if (!gh.isConfigured()) {
    return json({
      configured: false,
      totals: { commits: 0, openPRs: 0, openIssues: 0, failingWorkflows: 0 },
      recentCommits: [],
      failingWorkflows: [],
      recentReleases: [],
      openPRs: [],
    });
  }
  const [commits, prs, issues, fails, releases] = await Promise.all([
    Promise.all(PROJECTS.map((p) => gh.listCommits(p.repo, 4).then((cs) => cs.map((c) => ({ ...c, repo: p.repo }))).catch(() => []))),
    Promise.all(PROJECTS.map((p) => gh.listOpenPRs(p.repo).then((ps) => ps.map((x) => ({ ...x, repo: p.repo }))).catch(() => []))),
    Promise.all(PROJECTS.map((p) => gh.listOpenIssues(p.repo).catch(() => []))),
    Promise.all(PROJECTS.map((p) => gh.listFailingWorkflows(p.repo).then((ws) => ws.map((w) => ({ ...w, repo: p.repo }))).catch(() => []))),
    Promise.all(PROJECTS.map((p) => gh.listReleases(p.repo).then((rs) => rs.map((r) => ({ ...r, repo: p.repo }))).catch(() => []))),
  ]);
  const flatCommits = commits.flat().sort((a, b) => b.ts - a.ts).slice(0, 20);
  const flatPRs = prs.flat().sort((a, b) => b.ts - a.ts);
  const totals = {
    commits: flatCommits.length,
    openPRs: flatPRs.length,
    openIssues: issues.flat().length,
    failingWorkflows: fails.flat().length,
  };
  return json({
    configured: true,
    totals,
    recentCommits: flatCommits,
    openPRs: flatPRs,
    failingWorkflows: fails.flat().slice(0, 12),
    recentReleases: releases.flat().sort((a, b) => b.ts - a.ts).slice(0, 12),
  });
};
