/**
 * Cloudflare API adapter.
 *
 * Reads CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ZONE_ID.
 */
import type { Env } from "../_lib/env";

const API = "https://api.cloudflare.com/client/v4";

type CfResp<T> = { success: boolean; errors?: { code: number; message: string }[]; result: T };

export class CloudflareAdapter {
  private token: string | undefined;
  private accountId: string | undefined;
  private zoneId: string | undefined;
  constructor(env: Env) {
    this.token = env.CLOUDFLARE_API_TOKEN;
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
    this.zoneId = env.CLOUDFLARE_ZONE_ID;
  }
  isConfigured() {
    return Boolean(this.token && this.accountId);
  }

  private async cf<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.token) throw new Error("CLOUDFLARE_API_TOKEN not configured");
    const res = await fetch(API + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const body = (await res.json()) as CfResp<T>;
    if (!res.ok || !body.success) {
      throw new Error(`Cloudflare ${res.status}: ${body.errors?.[0]?.message ?? res.statusText}`);
    }
    return body.result;
  }

  async tokenHealth(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.token) return { ok: false, reason: "no token" };
    try {
      await this.cf<unknown>("/user/tokens/verify");
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "verify failed" };
    }
  }

  async getAccount() {
    if (!this.accountId) return null;
    return this.cf<{ id: string; name: string }>(`/accounts/${this.accountId}`);
  }

  async listPagesProjects() {
    if (!this.accountId) return [];
    return this.cf<{ name: string; subdomain: string; latest_deployment?: { stage?: string; modified_on?: string; deployment_trigger?: { metadata?: { commit_hash?: string } } } }[]>(
      `/accounts/${this.accountId}/pages/projects?per_page=50`,
    );
  }
  async listPagesDeployments(projectName: string) {
    if (!this.accountId) return [];
    return this.cf<{ id: string; latest_stage?: { name?: string; status?: string }; created_on: string; deployment_trigger?: { metadata?: { commit_hash?: string } } }[]>(
      `/accounts/${this.accountId}/pages/projects/${projectName}/deployments?per_page=10`,
    );
  }
  async listWorkers() {
    if (!this.accountId) return [];
    return this.cf<{ id: string; modified_on: string }[]>(`/accounts/${this.accountId}/workers/scripts`);
  }
  async listZones() {
    return this.cf<{ id: string; name: string; status: string }[]>("/zones?per_page=50");
  }
  async listD1() {
    if (!this.accountId) return [];
    return this.cf<{ uuid: string; name: string }[]>(`/accounts/${this.accountId}/d1/database`);
  }
  async listKv() {
    if (!this.accountId) return [];
    return this.cf<{ id: string; title: string }[]>(`/accounts/${this.accountId}/storage/kv/namespaces?per_page=100`);
  }
}
