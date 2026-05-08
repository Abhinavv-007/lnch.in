/**
 * GitHub REST adapter.
 *
 * Token usage: the only place we read GITHUB_TOKEN from env. All HTTP calls
 * go through `gh()` so we can centralize headers, error shape and
 * permission-health checks.
 */
import type { Env } from "../_lib/env";

const API = "https://api.github.com";

type GhRequestInit = RequestInit & { search?: Record<string, string | number | undefined> };

export class GithubAdapter {
  private token: string | undefined;
  private cache = new Map<string, { ts: number; payload: unknown }>();

  constructor(env: Env) {
    this.token = env.GITHUB_TOKEN;
  }

  isConfigured() {
    return Boolean(this.token);
  }

  async gh<T>(path: string, init: GhRequestInit = {}): Promise<T> {
    if (!this.token) throw new Error("GITHUB_TOKEN not configured");
    const url = new URL(API + path);
    if (init.search) {
      for (const [k, v] of Object.entries(init.search)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "lnch.in-launchops",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  /** Cached for the duration of one request worker. */
  async ghCached<T>(path: string, ttlSec: number, init: GhRequestInit = {}): Promise<T> {
    const key = `${path}?${new URLSearchParams(Object.fromEntries(Object.entries(init.search ?? {}).map(([k, v]) => [k, String(v ?? "")])))}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() / 1000 - hit.ts < ttlSec) return hit.payload as T;
    const payload = await this.gh<T>(path, init);
    this.cache.set(key, { ts: Date.now() / 1000, payload });
    return payload;
  }

  async listCommits(repo: string, perPage = 8) {
    type Item = { sha: string; commit: { message: string; author?: { name?: string; date?: string } }; author?: { login?: string } | null };
    const data = await this.gh<Item[]>(`/repos/${repo}/commits`, { search: { per_page: perPage } });
    return data.map((c) => ({
      sha: c.sha,
      message: (c.commit.message || "").split("\n")[0].slice(0, 140),
      author: c.author?.login ?? c.commit.author?.name ?? "unknown",
      ts: c.commit.author?.date ? Date.parse(c.commit.author.date) : Date.now(),
    }));
  }

  async listBranches(repo: string) {
    type Item = { name: string };
    const data = await this.gh<Item[]>(`/repos/${repo}/branches`, { search: { per_page: 50 } });
    return data.map((b) => b.name);
  }

  async listOpenIssues(repo: string) {
    type Item = { number: number; title: string; pull_request?: unknown; created_at: string; user: { login: string } };
    const data = await this.gh<Item[]>(`/repos/${repo}/issues`, { search: { state: "open", per_page: 50 } });
    return data.filter((i) => !i.pull_request).map((i) => ({
      number: i.number,
      title: i.title,
      ts: Date.parse(i.created_at),
      author: i.user.login,
    }));
  }

  async listOpenPRs(repo: string) {
    type Item = { number: number; title: string; created_at: string; user: { login: string } };
    const data = await this.gh<Item[]>(`/repos/${repo}/pulls`, { search: { state: "open", per_page: 50 } });
    return data.map((p) => ({
      number: p.number,
      title: p.title,
      ts: Date.parse(p.created_at),
      author: p.user.login,
    }));
  }

  async listReleases(repo: string) {
    type Item = { name: string | null; tag_name: string; published_at: string };
    const data = await this.gh<Item[]>(`/repos/${repo}/releases`, { search: { per_page: 5 } });
    return data.map((r) => ({
      name: r.name ?? r.tag_name,
      tag: r.tag_name,
      ts: r.published_at ? Date.parse(r.published_at) : 0,
    }));
  }

  async listFailingWorkflows(repo: string) {
    type Item = { name: string; conclusion: string | null; updated_at: string };
    const data = await this.gh<{ workflow_runs: Item[] }>(`/repos/${repo}/actions/runs`, {
      search: { per_page: 25, status: "completed" },
    });
    return (data.workflow_runs || [])
      .filter((r) => r.conclusion && r.conclusion !== "success" && r.conclusion !== "skipped")
      .slice(0, 8)
      .map((r) => ({ name: r.name, conclusion: r.conclusion!, ts: Date.parse(r.updated_at) }));
  }

  /**
   * GitHub contribution calendar (53-week × 7-day grid). Uses the GraphQL
   * endpoint because the REST API does not expose this. Token only needs
   * `read:user` scope (the public profile route is enough).
   */
  async getContributionCalendar(login: string): Promise<{
    totalContributions: number;
    weeks: { firstDay: string; days: { date: string; count: number; weekday: number; color?: string }[] }[];
  }> {
    if (!this.token) throw new Error("GITHUB_TOKEN not configured");
    const query = `query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              firstDay
              contributionDays { date contributionCount weekday color }
            }
          }
        }
      }
    }`;
    const res = await fetch(`${API}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "lnch.in-launchops",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { login } }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub GraphQL ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      data?: {
        user?: {
          contributionsCollection?: {
            contributionCalendar?: {
              totalContributions: number;
              weeks: { firstDay: string; contributionDays: { date: string; contributionCount: number; weekday: number; color?: string }[] }[];
            };
          };
        };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      throw new Error(`GitHub GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    const cal = json.data?.user?.contributionsCollection?.contributionCalendar;
    if (!cal) throw new Error("GitHub GraphQL: empty contribution calendar");
    return {
      totalContributions: cal.totalContributions,
      weeks: cal.weeks.map((w) => ({
        firstDay: w.firstDay,
        days: w.contributionDays.map((d) => ({
          date: d.date,
          count: d.contributionCount,
          weekday: d.weekday,
          color: d.color,
        })),
      })),
    };
  }

  async tokenScopeHealth(): Promise<{ ok: boolean; scopes: string[]; reason?: string }> {
    if (!this.token) return { ok: false, scopes: [], reason: "no token" };
    const res = await fetch(`${API}/rate_limit`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "lnch.in-launchops",
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return { ok: false, scopes: [], reason: `${res.status}` };
    const scopes = (res.headers.get("x-oauth-scopes") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return { ok: true, scopes };
  }
}
