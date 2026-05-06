import { type Env, json } from "../../../_lib/env";
import { gate } from "../_gate";
import { GithubAdapter } from "../../../_adapters/github";
import { PROJECT_BY_SLUG } from "../../../_lib/projects";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const url = new URL(request.url);
  const slug = url.searchParams.get("project") ?? "";
  const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get("per_page") ?? 20)));
  const project = PROJECT_BY_SLUG[slug];
  if (!project) return json({ commits: [] }, { status: 404 });
  const gh = new GithubAdapter(env);
  if (!gh.isConfigured()) return json({ commits: [] });
  const commits = await gh.listCommits(project.repo, perPage).catch(() => []);
  return json({ commits });
};
