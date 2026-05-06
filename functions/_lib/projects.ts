/**
 * Server mirror of the project registry.
 *
 * Kept hand-synced with `src/lib/projects.ts` rather than imported because the
 * Functions runtime and the Vite client build don't share a TypeScript
 * project. Both files are short.
 *
 * Per-project admin secrets (Q1 of the Phase 0 plan): each project ships its
 * own admin API guarded by its own secret. Adding a new project here means
 * adding the matching `<SLUG>_ADMIN_SECRET` to `Env` in `_lib/env.ts` and
 * provisioning it in Pages.
 */
export type AdminSecretEnv =
  | "LAUNCHOPS_ADMIN_SECRET"
  | "MODIH_ADMIN_SECRET"
  | "CLEX_ADMIN_SECRET"
  | "CLEX_AI_ADMIN_SECRET"
  | "DRIPED_ADMIN_SECRET"
  | "TRGT_ADMIN_SECRET";

export type ServerProject = {
  slug: string;
  name: string;
  repo: string;          // owner/name
  site?: string;
  health?: string[];
  firebaseEnvPrefix?: string; // FIREBASE_<X>
  adminSecretEnv: AdminSecretEnv;
  adminBaseUrl?: string;      // for project-side admin APIs
};

export const PROJECTS: ServerProject[] = [
  {
    slug: "modih",
    name: "Modih Mail",
    repo: "Abhinavv-007/modih-email",
    site: "https://modih.in",
    health: ["https://modih.in/api/health"],
    firebaseEnvPrefix: "FIREBASE_MODIH",
    adminSecretEnv: "MODIH_ADMIN_SECRET",
    adminBaseUrl: "https://modih.in/api/admin",
  },
  {
    slug: "clex",
    name: "Clex",
    repo: "Abhinavv-007/clex",
    site: "https://clex.in",
    health: [
      "https://clex.in/api/health",
      "https://clex.in/chain/health",
      "https://signal.clex.in/health",
      "https://clex.in/vault/api/health",
    ],
    firebaseEnvPrefix: "FIREBASE_CLEX",
    adminSecretEnv: "CLEX_ADMIN_SECRET",
    adminBaseUrl: "https://clex.in/api/admin",
  },
  {
    // Site (marketing) is ai.clex.in; the API + dashboard live on the new
    // alias api.ai.clex.in. The legacy api.clex.in continues to work as a
    // probe target while DNS/TLS for api.ai.clex.in finishes provisioning.
    slug: "clex-ai",
    name: "Clex AI",
    repo: "Abhinavv-007/clex-ai",
    site: "https://ai.clex.in",
    health: [
      "https://api.ai.clex.in/api/health",
      "https://api.clex.in/api/health",
    ],
    firebaseEnvPrefix: "FIREBASE_CLEX_AI",
    adminSecretEnv: "CLEX_AI_ADMIN_SECRET",
    adminBaseUrl: "https://api.ai.clex.in/api/admin",
  },
  {
    slug: "driped",
    name: "Driped",
    repo: "Abhinavv-007/DRIPED-Web",
    site: "https://driped.in",
    health: ["https://driped.in/api/health"],
    firebaseEnvPrefix: "FIREBASE_DRIPED",
    adminSecretEnv: "DRIPED_ADMIN_SECRET",
    adminBaseUrl: "https://driped.in/api/admin",
  },
  {
    slug: "trgt",
    name: "TRGT",
    repo: "Abhinavv-007/f1",
    site: "https://trgt.in",
    health: ["https://trgt.in/api/health"],
    firebaseEnvPrefix: "FIREBASE_TRGT",
    adminSecretEnv: "TRGT_ADMIN_SECRET",
    adminBaseUrl: "https://trgt.in/api/admin",
  },
  {
    // Portfolio is a static site without an admin API. It still appears in
    // the registry for the public landing & the LaunchOps overview, but the
    // adminSecretEnv falls back to LAUNCHOPS_ADMIN_SECRET (effectively a
    // no-op since there's nothing to call).
    slug: "portfolio",
    name: "Portfolio",
    repo: "Abhinavv-007/Portfolio",
    site: "https://abhnv.in",
    firebaseEnvPrefix: "FIREBASE_PORTFOLIO",
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
  },
];

export const PROJECT_BY_SLUG: Record<string, ServerProject> = Object.fromEntries(
  PROJECTS.map((p) => [p.slug, p]),
);

export const PROJECT_BY_REPO: Record<string, ServerProject> = Object.fromEntries(
  PROJECTS.map((p) => [p.repo.toLowerCase(), p]),
);
