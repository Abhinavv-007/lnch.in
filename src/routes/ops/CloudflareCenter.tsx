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
  d1Databases: { name: string; uuid: string }[];
  kvNamespaces: { title: string; id: string }[];
  reason?: string;
};

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
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Pages projects" value={data?.pagesProjects.length ?? "…"} tone="gilt" />
        <StatCard label="Workers" value={data?.workers.length ?? "…"} tone="info" />
        <StatCard label="Zones" value={data?.zones.length ?? "…"} tone="neutral" />
        <StatCard label="D1 / KV" value={data ? `${data.d1Databases.length} / ${data.kvNamespaces.length}` : "…"} tone="gilt" />
      </section>
      <div className="panel p-5">
        <SectionTitle>Pages projects</SectionTitle>
        <ul className="divide-y divide-ink-600/40 text-sm">
          {(data?.pagesProjects ?? []).map((p) => (
            <li key={p.name} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="text-ink-100">{p.name}</span>{" "}
                <span className="text-xs text-ink-300">.pages.dev</span>
              </span>
              <span className="text-xs text-ink-300">{p.latest ? p.latest.state : "—"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle>Zones</SectionTitle>
          <ul className="divide-y divide-ink-600/40 text-sm">
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
          <ul className="divide-y divide-ink-600/40 text-sm">
            {(data?.d1Databases ?? []).map((d) => (
              <li key={d.uuid} className="flex items-center justify-between py-2">
                <span>{d.name}</span>
                <span className="font-mono text-xs text-ink-300">{d.uuid.slice(0, 8)}</span>
              </li>
            ))}
            {(data?.kvNamespaces ?? []).map((kv) => (
              <li key={kv.id} className="flex items-center justify-between py-2">
                <span>{kv.title}</span>
                <span className="font-mono text-xs text-ink-300">{kv.id.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
