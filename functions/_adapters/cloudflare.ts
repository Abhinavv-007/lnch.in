/**
 * Cloudflare API adapter.
 *
 * Reads CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ZONE_ID.
 */
import type { Env } from "../_lib/env";

const API = "https://api.cloudflare.com/client/v4";

type CfResp<T> = { success: boolean; errors?: { code: number; message: string }[]; result: T };

type CfGraphqlResp<T> = { data?: T; errors?: { message: string }[] };

export type ZoneTrafficDay = {
  date: string;
  requests: number;
  pageViews: number;
  uniqueVisitors: number;
  bytes: number;
  cachedRequests: number;
  encryptedRequests: number;
  threats: number;
};

export type ZoneTrafficSummary = {
  zoneId: string;
  zoneName: string;
  since: string;
  until: string;
  totals: Omit<ZoneTrafficDay, "date">;
  series: ZoneTrafficDay[];
};

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

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    if (!this.token) throw new Error("CLOUDFLARE_API_TOKEN not configured");
    const res = await fetch(`${API}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json()) as CfGraphqlResp<T>;
    if (!res.ok || body.errors?.length) {
      throw new Error(body.errors?.[0]?.message ?? `Cloudflare GraphQL ${res.status}`);
    }
    if (!body.data) throw new Error("Cloudflare GraphQL returned no data");
    return body.data;
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

  async getZoneTraffic(zone: { id: string; name: string }): Promise<ZoneTrafficSummary> {
    const until = new Date();
    const since = new Date(until.getTime() - 6 * 24 * 60 * 60 * 1000);
    const date = (d: Date) => d.toISOString().slice(0, 10);
    const sinceDate = date(since);
    const untilDate = date(until);
    type GraphqlData = {
      viewer: {
        zones: {
          httpRequests1dGroups: {
            dimensions: { date: string };
            sum: {
              requests?: number;
              bytes?: number;
              pageViews?: number;
              cachedRequests?: number;
              encryptedRequests?: number;
              threats?: number;
            };
            uniq: { uniques?: number };
          }[];
        }[];
      };
    };
    const data = await this.graphql<GraphqlData>(
      `query($zoneTag: string, $since: Date, $until: Date) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1dGroups(
              limit: 7
              filter: { date_geq: $since, date_leq: $until }
              orderBy: [date_ASC]
            ) {
              dimensions { date }
              sum { requests bytes pageViews cachedRequests encryptedRequests threats }
              uniq { uniques }
            }
          }
        }
      }`,
      { zoneTag: zone.id, since: sinceDate, until: untilDate },
    );
    const rows = data.viewer.zones[0]?.httpRequests1dGroups ?? [];
    const series = rows.map((row) => ({
      date: row.dimensions.date,
      requests: row.sum.requests ?? 0,
      pageViews: row.sum.pageViews ?? 0,
      uniqueVisitors: row.uniq.uniques ?? 0,
      bytes: row.sum.bytes ?? 0,
      cachedRequests: row.sum.cachedRequests ?? 0,
      encryptedRequests: row.sum.encryptedRequests ?? 0,
      threats: row.sum.threats ?? 0,
    }));
    const totals = series.reduce<Omit<ZoneTrafficDay, "date">>(
      (acc, day) => ({
        requests: acc.requests + day.requests,
        pageViews: acc.pageViews + day.pageViews,
        uniqueVisitors: acc.uniqueVisitors + day.uniqueVisitors,
        bytes: acc.bytes + day.bytes,
        cachedRequests: acc.cachedRequests + day.cachedRequests,
        encryptedRequests: acc.encryptedRequests + day.encryptedRequests,
        threats: acc.threats + day.threats,
      }),
      {
        requests: 0,
        pageViews: 0,
        uniqueVisitors: 0,
        bytes: 0,
        cachedRequests: 0,
        encryptedRequests: 0,
        threats: 0,
      },
    );
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      since: sinceDate,
      until: untilDate,
      totals,
      series,
    };
  }
}
