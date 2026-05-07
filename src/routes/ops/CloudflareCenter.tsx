import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import StatCard from "@/components/ops/StatCard";
import MissingIntegration from "@/components/ops/MissingIntegration";
import { api } from "@/lib/api";

type Bundle = {
  configured: boolean;
  account: { name: string; id: string } | null;
  pagesProjects: { name: string; subdomain: string; latest: { state: string; ts: number } | null }[];
  workers: { name: string; ts: number }[];
  zones: { name: string; status: string; id: string }[];
  traffic?: {
    configured: boolean;
    reason: string | null;
    zones: {
      zoneId: string;
      zoneName: string;
      since: string;
      until: string;
      totals: {
        requests: number;
        pageViews: number;
        uniqueVisitors: number;
        bytes: number;
        cachedRequests: number;
        encryptedRequests: number;
        threats: number;
      };
    }[];
  };
  d1Databases: { name: string; uuid: string }[];
  kvNamespaces: { title: string; id: string }[];
  reason?: string;
};

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const bytes = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function sumTraffic(data: Bundle | null, key: keyof NonNullable<Bundle["traffic"]>["zones"][number]["totals"]) {
  return (data?.traffic?.zones ?? []).reduce((total, zone) => total + zone.totals[key], 0);
}

function formatBytes(value: number) {
  return `${bytes.format(value)}B`;
}

export default function CloudflareCenter() {
  const [data, setData] = useState<Bundle | null>(null);
  useEffect(() => {
    api.get<Bundle>("/api/ops/cloudflare").then(setData).catch(() => setData(null));
  }, []);
  if (data && !data.configured) {
    return (
      <MissingIntegration
        title="Cloudflare not connected"
        reason={data.reason ?? "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID."}
        needs={["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]}
      />
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="cloudflare" title="Cloudflare" description={data?.account ? `${data.account.name} · ${data.account.id.slice(0, 12)}…` : "Pages, Workers, D1, KV, Zones."} />
      <section className="poster-stagger grid gap-3 md:grid-cols-4">
        <StatCard label="Pages projects" value={data?.pagesProjects.length ?? "…"} tone="gilt" />
        <StatCard label="Workers" value={data?.workers.length ?? "…"} tone="info" />
        <StatCard label="Zones" value={data?.zones.length ?? "…"} tone="neutral" />
        <StatCard label="D1 / KV" value={data ? `${data.d1Databases.length} / ${data.kvNamespaces.length}` : "…"} tone="gilt" />
      </section>
      <section className="poster-stagger grid gap-3 md:grid-cols-4">
        <StatCard label="7d requests" value={data?.traffic?.configured ? compact.format(sumTraffic(data, "requests")) : "—"} tone="info" />
        <StatCard label="7d page views" value={data?.traffic?.configured ? compact.format(sumTraffic(data, "pageViews")) : "—"} tone="gilt" />
        <StatCard label="7d uniques" value={data?.traffic?.configured ? compact.format(sumTraffic(data, "uniqueVisitors")) : "—"} tone="neutral" />
        <StatCard label="7d bandwidth" value={data?.traffic?.configured ? formatBytes(sumTraffic(data, "bytes")) : "—"} tone="ok" />
      </section>
      {data?.traffic && !data.traffic.configured ? (
        <MissingIntegration
          title="Cloudflare analytics unavailable"
          reason={data.traffic.reason ?? "Add Zone Analytics: Read to CLOUDFLARE_API_TOKEN to show traffic metrics."}
          needs={["CLOUDFLARE_API_TOKEN with Zone Analytics: Read"]}
        />
      ) : null}
      <div className="panel p-5">
        <SectionTitle>Pages projects</SectionTitle>
        <ul className="divide-rule text-sm">
          {(data?.pagesProjects ?? []).map((p) => (
            <li key={p.name} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="text-fg">{p.name}</span>{" "}
                <span className="text-xs text-fg-soft">.pages.dev</span>
              </span>
              <span className="text-xs text-fg-soft">{p.latest ? p.latest.state : "—"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel p-5">
        <SectionTitle>Zone traffic · last 7 days</SectionTitle>
        <ul className="divide-rule text-sm">
          {(data?.traffic?.zones ?? []).map((zone) => (
            <li key={zone.zoneId} className="grid gap-2 py-3 md:grid-cols-[1.3fr_repeat(5,minmax(0,1fr))] md:items-center">
              <span>
                <span className="text-fg">{zone.zoneName}</span>{" "}
                <span className="text-xs text-fg-soft">{zone.since} → {zone.until}</span>
              </span>
              <span className="text-fg-soft">req <b className="text-fg">{compact.format(zone.totals.requests)}</b></span>
              <span className="text-fg-soft">views <b className="text-fg">{compact.format(zone.totals.pageViews)}</b></span>
              <span className="text-fg-soft">unique <b className="text-fg">{compact.format(zone.totals.uniqueVisitors)}</b></span>
              <span className="text-fg-soft">data <b className="text-fg">{formatBytes(zone.totals.bytes)}</b></span>
              <span className={zone.totals.threats ? "pill-warn" : "pill-ok"}>{compact.format(zone.totals.threats)} threats</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle>Zones</SectionTitle>
          <ul className="divide-rule text-sm">
            {(data?.zones ?? []).map((z) => (
              <li key={z.id} className="flex items-center justify-between py-2">
                <span>{z.name}</span>
                <span className={z.status === "active" ? "pill-ok" : "pill-warn"}>{z.status}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <SectionTitle>D1 databases & KV namespaces</SectionTitle>
          <ul className="divide-rule text-sm">
            {(data?.d1Databases ?? []).map((d) => (
              <li key={d.uuid} className="flex items-center justify-between py-2">
                <span>{d.name}</span>
                <span className="font-mono text-xs text-fg-soft">{d.uuid.slice(0, 8)}</span>
              </li>
            ))}
            {(data?.kvNamespaces ?? []).map((kv) => (
              <li key={kv.id} className="flex items-center justify-between py-2">
                <span>{kv.title}</span>
                <span className="font-mono text-xs text-fg-soft">{kv.id.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
