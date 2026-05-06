import { type Env, json } from "../../_lib/env";
import { gate } from "./_gate";
import * as firebase from "../../_adapters/firebase";
import { PROJECTS } from "../../_lib/projects";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const slugs = firebase.configuredSlugs(env);
  const perProject = await Promise.all(
    PROJECTS.map(async (p) => {
      if (!slugs.includes(p.slug)) {
        return { slug: p.slug, project: p.name, userCount: null as number | null, reason: "not configured" };
      }
      const r = await firebase.getUserCount(env, p.slug);
      return { slug: p.slug, project: p.name, userCount: r.userCount, reason: r.reason };
    }),
  );
  return json({ firebase: { configured: slugs.length > 0, perProject } });
};
