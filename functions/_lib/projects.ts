/**
 * Server mirror of the project registry.
 *
 * Kept hand-synced with `src/lib/projects.ts` rather than imported because the
 * Functions runtime and the Vite client build don't share a TypeScript
 * project. Both files are short.
 */
export type ServerProject = {
  slug: string;
  name: string;
  repo: string;          // owner/name
  site?: string;
  health?: string[];
  firebaseEnvPrefix?: string; // FIREBASE_<X>
  adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET" | "MODIH_ADMIN_SECRET";
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
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
  },
  {
    slug: "clex-ai",
    name: "Clex AI",
    repo: "Abhinavv-007/clex-ai",
    site: "https://ai.clex.in",
    health: ["https://ai.clex.in/api/health"],
    firebaseEnvPrefix: "FIREBASE_CLEX_AI",
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
  },
  {
    slug: "driped",
    name: "Driped",
    repo: "Abhinavv-007/DRIPED-Web",
    site: "https://driped.in",
    health: ["https://driped.in/api/health"],
    firebaseEnvPrefix: "FIREBASE_DRIPED",
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
  },
  {
    slug: "trgt",
    name: "TRGT",
    repo: "Abhinavv-007/f1",
    site: "https://trgt.in",
    health: ["https://trgt.in/api/health"],
    firebaseEnvPrefix: "FIREBASE_TRGT",
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
  },
  {
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
