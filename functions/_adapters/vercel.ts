/**
 * Vercel API adapter.
 *
 * Reads VERCEL_TOKEN and (optionally) VERCEL_TEAM_ID.
 */
import type { Env } from "../_lib/env";

const API = "https://api.vercel.com";

export class VercelAdapter {
  private token: string | undefined;
  private team: string | undefined;
  constructor(env: Env) {
    this.token = env.VERCEL_TOKEN;
    this.team = env.VERCEL_TEAM_ID;
  }
  isConfigured() {
    return Boolean(this.token);
  }
  private async v<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.token) throw new Error("VERCEL_TOKEN not configured");
    const url = new URL(API + path);
    if (this.team) url.searchParams.set("teamId", this.team);
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Vercel ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  async tokenHealth(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.token) return { ok: false, reason: "no token" };
    try {
      await this.v<unknown>("/v2/user");
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "verify failed" };
    }
  }
  async listProjects() {
    return (await this.v<{ projects: { id: string; name: string; framework?: string; latestDeployments?: { state: string; createdAt: number; url?: string }[] }[] }>("/v9/projects?limit=50")).projects;
  }
  async listRecentDeployments(limit = 30) {
    type D = { uid: string; name: string; state: string; createdAt: number; meta?: { githubCommitSha?: string }; url?: string; target?: string };
    return (await this.v<{ deployments: D[] }>(`/v6/deployments?limit=${limit}`)).deployments;
  }
  async listDomains() {
    return (await this.v<{ domains: { name: string; verified: boolean }[] }>("/v5/domains?limit=50")).domains;
  }
}
