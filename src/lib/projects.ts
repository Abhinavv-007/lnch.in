/**
 * Static project registry shared between the LaunchOps client and server.
 * Keep this minimal — anything that should be editable at runtime (notes,
 * tasks, settings) lives in D1.
 */
export type ProjectKind = "web" | "api" | "experience";

export type ProjectIntegrationStatus = {
  github: boolean;
  cloudflare?: boolean;
  vercel?: boolean;
  firebase?: boolean;
  /** Set when the project ships its own admin API. */
  customAdminApi?: boolean;
};

/**
 * Per-project admin secret env-var name. Mirrors the server type in
 * `functions/_lib/projects.ts`. Anything that isn't `LAUNCHOPS_ADMIN_SECRET`
 * means "this project ships its own admin API and the lnch.in proxy must
 * forward the per-project secret server-side".
 */
export type AdminSecretEnv =
  | "LAUNCHOPS_ADMIN_SECRET"
  | "MODIH_ADMIN_SECRET"
  | "CLEX_ADMIN_SECRET"
  | "CLEX_AI_ADMIN_SECRET"
  | "DRIPED_ADMIN_SECRET"
  | "TRGT_ADMIN_SECRET";

export type Project = {
  slug: string;
  name: string;
  kind: ProjectKind;
  site?: string;
  repo: string; // owner/name
  blurb: string;
  /** Brand accent — Tailwind class, e.g. text-accent, text-emerald-300. */
  accent: string;
  mobileApps?: { platform: "android" | "ios"; label: string }[];
  /** Endpoints the API center can ping for health. */
  health?: string[];
  /** ‘inherits LAUNCHOPS_ADMIN_SECRET’ unless they have their own. */
  adminSecretEnv?: AdminSecretEnv;
};

export const PROJECTS: Project[] = [
  {
    slug: "modih",
    name: "Modih Mail",
    kind: "web",
    site: "https://modih.in",
    repo: "Abhinavv-007/modih-email",
    blurb:
      "Disposable email at @modih.in. Cloudflare Pages + Functions + D1 + KV, premium API.",
    accent: "text-orange-300",
    mobileApps: [{ platform: "android", label: "Modih Android" }],
    health: ["https://modih.in/api/health"],
    adminSecretEnv: "MODIH_ADMIN_SECRET",
  },
  {
    slug: "clex",
    name: "Clex",
    kind: "web",
    site: "https://clex.in",
    repo: "Abhinavv-007/clex",
    blurb:
      "Privacy-first WebRTC file transfer. Workspace, Vault, Chain, signaling, transfer rooms.",
    accent: "text-emerald-300",
    mobileApps: [
      { platform: "android", label: "Clex Android" },
      { platform: "ios", label: "Clex iOS" },
    ],
    health: [
      "https://clex.in/api/health",
      "https://clex.in/chain/health",
      "https://signal.clex.in/health",
      "https://clex.in/vault/api/health",
    ],
    adminSecretEnv: "CLEX_ADMIN_SECRET",
  },
  {
    // Marketing site is ai.clex.in; the API + dashboard live on the new
    // alias api.ai.clex.in. api.clex.in is the legacy hostname kept alive
    // for backward-compat with any developer who already integrated.
    slug: "clex-ai",
    name: "Clex AI",
    kind: "api",
    site: "https://ai.clex.in",
    repo: "Abhinavv-007/clex-ai",
    blurb:
      "OpenAI-compatible gateway. 130+ models, smart routing, streaming, per-key analytics.",
    accent: "text-accent",
    health: [
      "https://api.ai.clex.in/api/health",
      "https://api.clex.in/api/health",
    ],
    adminSecretEnv: "CLEX_AI_ADMIN_SECRET",
  },
  {
    slug: "driped",
    name: "Driped",
    kind: "web",
    site: "https://driped.in",
    repo: "Abhinavv-007/DRIPED-Web",
    blurb:
      "Subscription tracker. Gmail scan, parser, AI fallback, savings analytics.",
    accent: "text-sky-300",
    mobileApps: [{ platform: "android", label: "Driped Android" }],
    health: ["https://driped.in/api/health"],
    adminSecretEnv: "DRIPED_ADMIN_SECRET",
  },
  {
    slug: "trgt",
    name: "TRGT",
    kind: "experience",
    site: "https://trgt.in",
    repo: "Abhinavv-007/f1",
    blurb:
      "F1-grade visual experience. Performance-heavy interactions, research-grade content.",
    accent: "text-rose-300",
    health: ["https://trgt.in/api/health"],
    adminSecretEnv: "TRGT_ADMIN_SECRET",
  },
  {
    slug: "portfolio",
    name: "Portfolio",
    kind: "web",
    site: "https://abhnv.in",
    repo: "Abhinavv-007/Portfolio",
    blurb: "abhnv.in — case studies, research, the work behind the launches.",
    accent: "text-violet-300",
    health: ["https://abhnv.in/api/health"],
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
  },
];

export const PROJECTS_BY_SLUG: Record<string, Project> = Object.fromEntries(
  PROJECTS.map((p) => [p.slug, p]),
);

/**
 * Per-project detail tab list.
 *
 * Each entry maps to a `<ProjectAdminTab>` Section in `routes/ops/ProjectDetail.tsx`.
 * The 13 tabs were chosen to expose every side of a project the operator
 * cares about — health, who's using the project, what keys are out there,
 * what's been audited, what's been deployed, what changed in the changelog,
 * security posture, open work, scratch notes, analytics, and the project
 * registry/settings.
 *
 * "github" is intentionally folded into Overview (latest commit + open PR/
 * issue/CI counters) and Changelog (releases) instead of being its own tab,
 * to keep the navigation compact and admin-shaped rather than tool-shaped.
 */
export const PROJECT_DETAIL_SECTIONS = [
  "overview",
  "health",
  "users",
  "api-consumers",
  "api-keys",
  "audit",
  "deployments",
  "changelog",
  "incidents",
  "security",
  "tasks",
  "notes",
  "analytics",
  "settings",
] as const;

export type ProjectDetailSection = (typeof PROJECT_DETAIL_SECTIONS)[number];

/** Display label for a tab (URL slug → human-friendly). */
export const PROJECT_DETAIL_LABELS: Record<ProjectDetailSection, string> = {
  overview: "overview",
  health: "health",
  users: "users",
  "api-consumers": "API consumers",
  "api-keys": "API keys",
  audit: "audit",
  deployments: "deployments",
  changelog: "changelog",
  incidents: "incidents",
  security: "security",
  tasks: "tasks",
  notes: "notes",
  analytics: "analytics",
  settings: "settings",
};

/**
 * Topics that the per-project admin proxy can fetch via
 * `GET /api/ops/projects/:slug/admin/:topic`. Each topic maps 1:1 to an
 * upstream admin endpoint at `${adminBaseUrl}/${topic}`.
 *
 * Keep this list and the server-side allowlist in
 * `functions/api/ops/projects/[slug]/admin/[topic].ts` in sync.
 */
export const PROJECT_ADMIN_TOPICS = [
  "users",
  "api-consumers",
  "api-keys",
  "audit",
  "security",
  "analytics",
  "health",
  "settings",
] as const;
export type ProjectAdminTopic = (typeof PROJECT_ADMIN_TOPICS)[number];
