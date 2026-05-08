/**
 * Portfolio (abhnv.in) adapter.
 *
 * The Portfolio site exposes a public read-only API at https://abhnv.in/api/*.
 * It is NOT admin-shaped (no auth, no privileged endpoints) — it's the
 * canonical machine-readable mirror of the public portfolio content. We use
 * it from /ops to give the Portfolio project tab real numbers and recent
 * content (projects, certifications, research, notes) instead of the
 * "missing integration" empty state.
 *
 * Caching:
 *   We cache responses in LAUNCHOPS_KV under a versioned key for ~60s. Since
 *   Portfolio is statically generated and changes only when the site is
 *   redeployed, this is plenty fresh while keeping the /ops page snappy and
 *   cheap (one round-trip per minute per endpoint, not per visit).
 *
 *   Errors are tolerated: we never throw out — callers always get a typed
 *   response describing exactly what's available so the UI can render an
 *   honest empty state.
 */
import type { Env } from "../_lib/env";

const BASE = "https://abhnv.in";
const TTL_SECONDS = 60;

type EndpointBody = unknown;

type FetchResult<T = EndpointBody> =
  | { ok: true; data: T; cached: boolean; ts: number }
  | { ok: false; status: number | null; reason: string };

function kvKey(path: string): string {
  // Versioned so a future schema change can invalidate cached payloads.
  return `portfolio:v1:${path}`;
}

async function readKv(env: Env, path: string): Promise<EndpointBody | null> {
  if (!env.LAUNCHOPS_KV) return null;
  try {
    const v = await env.LAUNCHOPS_KV.get(kvKey(path), "json");
    return v ?? null;
  } catch {
    return null;
  }
}

async function writeKv(env: Env, path: string, body: EndpointBody): Promise<void> {
  if (!env.LAUNCHOPS_KV) return;
  try {
    await env.LAUNCHOPS_KV.put(kvKey(path), JSON.stringify(body), {
      expirationTtl: TTL_SECONDS,
    });
  } catch {
    // KV write failures are non-fatal — the value will simply be re-fetched
    // on the next call.
  }
}

async function fetchPath<T = EndpointBody>(env: Env, path: string): Promise<FetchResult<T>> {
  const cached = await readKv(env, path);
  if (cached !== null) {
    return { ok: true, data: cached as T, cached: true, ts: Math.floor(Date.now() / 1000) };
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: {
        accept: "application/json",
        "user-agent": "lnch.in/portfolio-adapter (+https://lnch.in)",
      },
    });
  } catch (e) {
    return { ok: false, status: null, reason: `Upstream fetch failed: ${(e as Error)?.message ?? "unknown"}` };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, reason: `Upstream returned ${res.status}` };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    return { ok: false, status: res.status, reason: `Upstream returned non-JSON body: ${(e as Error)?.message ?? "unknown"}` };
  }
  await writeKv(env, path, body);
  return { ok: true, data: body as T, cached: false, ts: Math.floor(Date.now() / 1000) };
}

/**
 * Unwraps the standard `{ ok, data, meta? }` envelope used by the Portfolio
 * API. Returns the inner `data` if the envelope is present and ok=true,
 * otherwise the raw body. Callers that don't care about the envelope can
 * ignore this and read `result.data` directly.
 */
function unwrap<T>(body: unknown): T {
  if (
    body &&
    typeof body === "object" &&
    "ok" in body &&
    "data" in body &&
    (body as { ok: unknown }).ok === true
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export type PortfolioSummary = {
  profile: {
    name?: string;
    role?: string;
    site?: string;
    email?: string;
    location?: string;
    summary?: string;
  };
  counts: {
    projects: number;
    certifications: number;
    research: number;
    socials: number;
    notes: number;
    skillGroups: number;
    skills: number;
    commands: number;
    endpoints: number;
    tags: number;
    publicLinks: number;
    assets: number;
  };
};

export type PortfolioProject = {
  title: string;
  slug: string;
  description?: string;
  detail?: string;
  liveUrl?: string;
  repoUrl?: string;
  tags?: string[];
  type?: string;
};

export type PortfolioNote = {
  title: string;
  body?: string;
  slug?: string;
  date?: string;
  tags?: string[];
};

export type PortfolioCertification = {
  title: string;
  issuer?: string;
  date?: string;
  url?: string;
};

export type PortfolioResearch = {
  title: string;
  slug: string;
  abstract?: string;
  url?: string;
  date?: string;
};

export class PortfolioAdapter {
  constructor(private readonly env: Env) {}

  /** The Portfolio API is public — we're "configured" as long as the site is reachable. */
  isConfigured(): boolean {
    return true;
  }

  async summary(): Promise<FetchResult<PortfolioSummary>> {
    const r = await fetchPath(this.env, "/api/summary");
    if (!r.ok) return r;
    return { ...r, data: unwrap<PortfolioSummary>(r.data) };
  }

  async profile(): Promise<FetchResult<PortfolioSummary["profile"]>> {
    const r = await fetchPath(this.env, "/api/profile");
    if (!r.ok) return r;
    return { ...r, data: unwrap<PortfolioSummary["profile"]>(r.data) };
  }

  async projects(): Promise<FetchResult<PortfolioProject[]>> {
    const r = await fetchPath(this.env, "/api/projects");
    if (!r.ok) return r;
    return { ...r, data: unwrap<PortfolioProject[]>(r.data) };
  }

  async notes(): Promise<FetchResult<PortfolioNote[]>> {
    const r = await fetchPath(this.env, "/api/notes");
    if (!r.ok) return r;
    return { ...r, data: unwrap<PortfolioNote[]>(r.data) };
  }

  async certifications(): Promise<FetchResult<PortfolioCertification[]>> {
    const r = await fetchPath(this.env, "/api/certifications");
    if (!r.ok) return r;
    // /api/certifications returns groups-by-issuer; flatten for the operator view.
    const data = unwrap<unknown>(r.data);
    const flat: PortfolioCertification[] = [];
    if (Array.isArray(data)) {
      for (const group of data) {
        if (group && typeof group === "object" && "items" in group && Array.isArray((group as { items: unknown[] }).items)) {
          for (const item of (group as { items: PortfolioCertification[] }).items) {
            flat.push(item);
          }
        } else if (group && typeof group === "object" && "title" in group) {
          flat.push(group as PortfolioCertification);
        }
      }
    }
    return { ...r, data: flat };
  }

  async research(): Promise<FetchResult<PortfolioResearch[]>> {
    const r = await fetchPath(this.env, "/api/research");
    if (!r.ok) return r;
    return { ...r, data: unwrap<PortfolioResearch[]>(r.data) };
  }

  /**
   * Best-effort overview snapshot — same shape as ModihAdapter so the
   * standard `admin: { available, needs, plannedEndpoints, snapshot }`
   * contract works for the Portfolio tab.
   */
  async overview(): Promise<{
    available: boolean;
    needs: string[];
    plannedEndpoints: string[];
    snapshot?: Record<string, number | string | null>;
  }> {
    const plannedEndpoints = [
      "GET https://abhnv.in/api/summary",
      "GET https://abhnv.in/api/projects",
      "GET https://abhnv.in/api/certifications",
      "GET https://abhnv.in/api/research",
      "GET https://abhnv.in/api/notes",
    ];
    const r = await this.summary();
    if (!r.ok) {
      return {
        available: false,
        needs: [r.reason],
        plannedEndpoints,
      };
    }
    const counts = r.data.counts ?? ({} as PortfolioSummary["counts"]);
    const snapshot: Record<string, number | string | null> = {
      "summary.projects": counts.projects ?? 0,
      "summary.certifications": counts.certifications ?? 0,
      "summary.research": counts.research ?? 0,
      "summary.notes": counts.notes ?? 0,
      "summary.skills": counts.skills ?? 0,
      "summary.endpoints": counts.endpoints ?? 0,
      "summary.tags": counts.tags ?? 0,
      "summary.publicLinks": counts.publicLinks ?? 0,
      "summary.cached": r.cached ? "true" : "false",
    };
    if (r.data.profile?.role) snapshot["profile.role"] = r.data.profile.role;
    if (r.data.profile?.location) snapshot["profile.location"] = r.data.profile.location;
    return {
      available: true,
      needs: [],
      plannedEndpoints,
      snapshot,
    };
  }
}
