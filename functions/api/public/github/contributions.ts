/**
 * GET /api/public/github/contributions
 *
 * Public-facing GitHub contribution calendar (53 weeks × 7 days) for the
 * landing-page heatmap below the API heatmap. Always returns the real
 * GitHub graph for `Abhinavv-007` — no mocks, no fabricated activity.
 *
 * Server-side fetch via the GraphQL API uses the LNCH GITHUB_TOKEN; the
 * browser never sees the token. KV-cached for ~10 minutes to absorb
 * landing-page load.
 */
import { type Env, json, nowSec } from "../../../_lib/env";
import { GithubAdapter } from "../../../_adapters/github";

const DEFAULT_LOGIN = "Abhinavv-007";
const KV_KEY = (login: string) => `gh:contrib:${login.toLowerCase()}`;
const KV_TTL_SEC = 10 * 60;

type ContribDay = { date: string; count: number; weekday: number; color?: string };
type ContribResponse = {
  login: string;
  totalContributions: number;
  weeks: { firstDay: string; days: ContribDay[] }[];
  generatedAt: number;
  source: "github" | "cache";
  available: boolean;
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request, waitUntil }) => {
  const url = new URL(request.url);
  const login = url.searchParams.get("user") || DEFAULT_LOGIN;
  const cacheKey = KV_KEY(login);

  // KV cache hit — return immediately.
  try {
    const cached = await env.LAUNCHOPS_KV.get(cacheKey);
    if (cached) {
      const payload = JSON.parse(cached) as ContribResponse;
      return json(
        { ...payload, source: "cache" as const },
        { headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=900" } },
      );
    }
  } catch {
    /* KV not configured — fall through to live fetch. */
  }

  const gh = new GithubAdapter(env);
  if (!gh.isConfigured()) {
    return json({
      login,
      totalContributions: 0,
      weeks: [],
      generatedAt: nowSec(),
      source: "github",
      available: false,
    } satisfies ContribResponse);
  }

  try {
    const cal = await gh.getContributionCalendar(login);
    const payload: ContribResponse = {
      login,
      totalContributions: cal.totalContributions,
      weeks: cal.weeks,
      generatedAt: nowSec(),
      source: "github",
      available: true,
    };
    if (typeof waitUntil === "function") {
      waitUntil(
        env.LAUNCHOPS_KV.put(cacheKey, JSON.stringify(payload), {
          expirationTtl: KV_TTL_SEC,
        }).catch(() => undefined),
      );
    }
    return json(payload, {
      headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch {
    return json({
      login,
      totalContributions: 0,
      weeks: [],
      generatedAt: nowSec(),
      source: "github",
      available: false,
    } satisfies ContribResponse);
  }
};
