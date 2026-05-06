import { type Env, json } from "../../_lib/env";
import { gate } from "./_gate";
import { GithubAdapter } from "../../_adapters/github";
import { CloudflareAdapter } from "../../_adapters/cloudflare";
import { VercelAdapter } from "../../_adapters/vercel";
import * as firebase from "../../_adapters/firebase";
import { PROJECTS } from "../../_lib/projects";
import { resolveRpAndOrigin } from "../../_lib/webauthn";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = await gate(request, env);
  if (g) return g;
  const gh = new GithubAdapter(env);
  const cf = new CloudflareAdapter(env);
  const vc = new VercelAdapter(env);
  const fbConfigured = firebase.isConfigured(env);
  const { rpId, origin } = resolveRpAndOrigin(request, env);
  return json({
    integrations: {
      github: { configured: gh.isConfigured() },
      cloudflare: { configured: cf.isConfigured() },
      vercel: { configured: vc.isConfigured() },
      firebase: { configured: fbConfigured },
    },
    firebaseProjects: PROJECTS.map((p) => ({
      slug: p.slug,
      configured: firebase.isConfigured(env, p.slug),
      projectId: firebase.projectIdFor(env, p.slug),
    })),
    appUrl: env.LAUNCHOPS_RP_ORIGIN ?? null,
    rpId,
    origin,
  });
};
