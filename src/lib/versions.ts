/**
 * lnch.in release log.
 *
 * Hand-curated from `git log --first-parent main` so the public landing
 * doesn't have to ship a /api/public/changelog GET to render the same
 * thing. Each entry maps to one merged PR.
 *
 * Versioning scheme — minor.patch.tweak:
 *
 *   - **major (0.x → 1.x)** bumps when the public API surface itself
 *     becomes a first-class deliverable. v0 is "operator + landing";
 *     v1 is "public APIs + adapters".
 *   - **minor** bumps within a major when a new top-level surface ships
 *     (heatmap, /developers, contact form, mobile pass).
 *   - **patch** bumps for polish on an existing surface within the same
 *     minor (e.g. heatmap full-year, particle redesign, mobile fixes).
 *
 * The most recent entry sits at the top so the rendered list is
 * newest-first by default.
 */
export type ReleaseTag = "feature" | "polish" | "fix" | "infra";

export type Release = {
  version: string;
  prNumber: number;
  date: string; // YYYY-MM-DD merged
  headline: string;
  bullets: string[];
  tags: ReleaseTag[];
};

export const RELEASES: Release[] = [
  {
    version: "1.8.0",
    prNumber: 24,
    date: "2026-05-10",
    headline: "Email correction · public release log · footer cleanup",
    bullets: [
      "Replaced 67@abhnv.in → abhnv@abhnv.in across footer, contact card, support endpoint",
      "Removed 'built on Cloudflare · everything is open source' tagline from footer",
      "Added a public release-log section on the landing (this list)",
    ],
    tags: ["fix", "polish"],
  },
  {
    version: "1.7.0",
    prNumber: 23,
    date: "2026-05-09",
    headline: "Mobile + particles + latency polish",
    bullets: [
      "Particles read theme tokens so they're visible on cream paper in light mode",
      "Latency strip rebuilt as a signal trace (per-sample candles + median + failure ticks)",
      "Heatmap + GitHub calendar mobile: fixed-cell horizontal scroll, hidden scrollbar, auto-scroll to today",
      "Public header drops search to its own row on mobile",
      "Footer adds LinkedIn + email; ops topbar shrinks search placeholder on mobile",
    ],
    tags: ["polish"],
  },
  {
    version: "1.6.0",
    prNumber: 22,
    date: "2026-05-09",
    headline: "Incidents tab + richer security panel",
    bullets: [
      "/ops/projects/:slug now has Changelog · Notes · Tasks · Incidents · Security · Settings tabs",
      "Security panel surfaces the public-API audit trail (consumers, keys, recent events)",
    ],
    tags: ["feature"],
  },
  {
    version: "1.5.0",
    prNumber: 21,
    date: "2026-05-09",
    headline: "Heatmap full-year + uptime palette + 3D particles",
    bullets: [
      "Heatmap is now 53 wk × 7 day with a curated random tier mix (some empty, some 1K, occasional 10K+)",
      "Uptime palette: 97.1 / 98.4 / 99.2 / 99.5 / 99.8 / 99.99 — never 100.00 anywhere",
      "Particles get banded depth + parallax orbit; broken /ops Bell + Activity icons replaced with Settings",
    ],
    tags: ["feature", "polish"],
  },
  {
    version: "1.4.0",
    prNumber: 20,
    date: "2026-05-09",
    headline: "Public landing polish — particles, heatmap, latency, support",
    bullets: [
      "ParticleField gets 3D drift; tabular numerals so digits stop fighting letters",
      "Per-cell heatmap hover with hour, ts, top endpoint, top consumer",
      "POST /api/public/support — Resend-backed contact form, KV rate-limited 5/IP/24h",
    ],
    tags: ["feature", "polish"],
  },
  {
    version: "1.3.0",
    prNumber: 19,
    date: "2026-05-08",
    headline: "Modih native admin panel in /ops with safe actions",
    bullets: [
      "/ops/projects/modih embeds the native Modih admin (allowlist + typed-confirm)",
      "MODIH_ADMIN_SECRET stays server-side; the SPA never sees it",
    ],
    tags: ["feature"],
  },
  {
    version: "1.2.0",
    prNumber: 18,
    date: "2026-05-08",
    headline: "Portfolio adapter — surface abhnv.in/api content in /ops",
    bullets: [
      "/ops/projects/portfolio reads abhnv.in/api in real time",
      "Public adapter respects rate limits and surfaces honest empty states",
    ],
    tags: ["feature"],
  },
  {
    version: "1.1.0",
    prNumber: 17,
    date: "2026-05-08",
    headline: "Cross-project public-API consumers / keys / audit in /ops",
    bullets: [
      "Single /ops/api view for every public-API consumer, key, and audit event across all six projects",
      "Audit excerpts are IP-masked before they reach the SPA",
    ],
    tags: ["feature"],
  },
  {
    version: "1.0.0",
    prNumber: 16,
    date: "2026-05-08",
    headline: "Per-project public APIs + IP rate limiting + /developers",
    bullets: [
      "Public APIs for every project: heatmap, probes-history, deployments, commits, analytics, uptime",
      "KV-backed IP rate limiting (1000/IP/day) with x-ratelimit-* headers",
      "/developers page with copy-paste curl / fetch / python for every endpoint",
    ],
    tags: ["feature", "infra"],
  },
  {
    version: "0.7.0",
    prNumber: 15,
    date: "2026-05-08",
    headline: "Public visibility expansion + real uptime/p95",
    bullets: [
      "Public landing expanded to mirror operator-side info wherever it's safe",
      "24h p95 latency + real uptime per project replaces synthetic placeholders",
    ],
    tags: ["feature"],
  },
  {
    version: "0.6.0",
    prNumber: 14,
    date: "2026-05-08",
    headline: "Real heatmap + GitHub calendar + per-particle cursor glow + probe freshness",
    bullets: [
      "Heatmap is sourced from real D1 events; GitHub contributions calendar runs server-side",
      "Per-particle highlight on cursor proximity (no more page-wide bloom)",
      "Probe freshness window: stale > 1h falls back to 'unknown' instead of stale 'down'",
    ],
    tags: ["feature", "polish"],
  },
  {
    version: "0.5.0",
    prNumber: 12,
    date: "2026-05-07",
    headline: "UX hotfixes — #status link, sign-in clarity, animated skeletons",
    bullets: [
      "Sign-in CTA disambiguated; skeletons gain motion so loading reads as 'live, not stuck'",
      "#status anchor scrolls to the live status terminal cleanly",
    ],
    tags: ["polish", "fix"],
  },
  {
    version: "0.4.0",
    prNumber: 11,
    date: "2026-05-07",
    headline: "13-tab ProjectAdmin + per-topic admin proxy",
    bullets: [
      "Operator-side ProjectAdmin with 13 admin tabs (logs, events, secrets, etc.)",
      "Per-topic /api/ops/<topic> proxies upstream admin endpoints with secret in env",
    ],
    tags: ["feature"],
  },
  {
    version: "0.3.0",
    prNumber: 8,
    date: "2026-05-07",
    headline: "Theme-aware sweep across ops + poster animations",
    bullets: [
      "Every operator screen flips cleanly between cream-paper and ink themes",
      "Poster cards gain pulse / scallop / gilt animations",
    ],
    tags: ["polish"],
  },
  {
    version: "0.2.0",
    prNumber: 7,
    date: "2026-05-07",
    headline: "Cohesive poster design system across landing / public / ops",
    bullets: [
      "Single poster-card system shared by every public + operator surface",
      "Mono eyebrows, serif italic headlines, gilt accents, scalloped edges",
    ],
    tags: ["polish"],
  },
  {
    version: "0.1.0",
    prNumber: 4,
    date: "2026-05-06",
    headline: "Phase 1 — public face rebuild · light/dark theme · /projects/:slug",
    bullets: [
      "Public landing + /projects/:slug per-project pages",
      "Typewriter + cursive system across the public surface",
      "Initial public APIs and theme tokens",
    ],
    tags: ["feature"],
  },
];

/** Latest version string (e.g. "1.8.0"). */
export const CURRENT_VERSION = RELEASES[0]?.version ?? "0.0.0";
