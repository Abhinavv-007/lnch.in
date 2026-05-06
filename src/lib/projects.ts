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

export type Project = {
  slug: string;
  name: string;
  kind: ProjectKind;
  site?: string;
  repo: string; // owner/name
  blurb: string;
  /** Brand accent — Tailwind class, e.g. text-gilt-300, text-emerald-300. */
  accent: string;
  mobileApps?: { platform: "android" | "ios"; label: string }[];
  /** Endpoints the API center can ping for health. */
  health?: string[];
  /** ‘inherits LAUNCHOPS_ADMIN_SECRET’ unless they have their own. */
  adminSecretEnv?: "LAUNCHOPS_ADMIN_SECRET" | "MODIH_ADMIN_SECRET";
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
    health: ["https://clex.in/api/health"],
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
  },
  {
    slug: "clex-ai",
    name: "Clex AI",
    kind: "api",
    site: "https://ai.clex.in",
    repo: "Abhinavv-007/clex-ai",
    blurb:
      "OpenAI-compatible gateway. 130+ models, smart routing, streaming, per-key analytics.",
    accent: "text-gilt-300",
    health: ["https://api.clex.in/v1/health", "https://ai.clex.in/api/health"],
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
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
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
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
    health: ["https://trgt.in/health"],
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
  },
  {
    slug: "portfolio",
    name: "Portfolio",
    kind: "web",
    site: "https://abhnv.in",
    repo: "Abhinavv-007/Portfolio",
    blurb: "abhnv.in — case studies, research, the work behind the launches.",
    accent: "text-violet-300",
    health: ["https://abhnv.in/sitemap.xml"],
    adminSecretEnv: "LAUNCHOPS_ADMIN_SECRET",
  },
];

export const PROJECTS_BY_SLUG: Record<string, Project> = Object.fromEntries(
  PROJECTS.map((p) => [p.slug, p]),
);

export const PROJECT_DETAIL_SECTIONS = [
  "overview",
  "admin",
  "github",
  "deployments",
  "apis",
  "logs",
  "analytics",
  "notes",
  "tasks",
  "changelog",
  "security",
  "settings",
] as const;

export type ProjectDetailSection = (typeof PROJECT_DETAIL_SECTIONS)[number];
