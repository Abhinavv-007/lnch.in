import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import StatCard from "@/components/ops/StatCard";
import MissingIntegration from "@/components/ops/MissingIntegration";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Bundle = {
  configured: boolean;
  team: { id: string; name: string } | null;
  projects: { id: string; name: string; framework?: string; latestDeployment?: { state: string; ts: number; url?: string } | null }[];
  domains: { name: string; verified?: boolean }[];
  recentDeployments: { project: string; state: string; ts: number; url?: string }[];
  reason?: string;
};

export default function VercelCenter() {
  const [data, setData] = useState<Bundle | null>(null);
  useEffect(() => {
    api.get<Bundle>("/api/ops/vercel").then(setData).catch(() => setData(null));
  }, []);
  if (data && !data.configured) {
    return (
      <MissingIntegration
        title="Vercel not connected"
        reason={data.reason ?? "Set VERCEL_TOKEN to surface deployments."}
        needs={["VERCEL_TOKEN"]}
      />
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="vercel" title="Vercel" description={data?.team ? `Team ${data.team.name}` : "Projects, deployments and domains."} />
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Projects" value={data?.projects.length ?? "…"} tone="gilt" />
        <StatCard label="Domains" value={data?.domains.length ?? "…"} tone="info" />
        <StatCard label="Deploys (24h)" value={data?.recentDeployments.length ?? "…"} tone="neutral" />
      </section>
      <div className="panel p-5">
        <SectionTitle>Projects</SectionTitle>
        <ul className="divide-y divide-ink-600/40 text-sm">
          {(data?.projects ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span>{p.name} <span className="text-xs text-ink-300">{p.framework ?? ""}</span></span>
              <span className="text-xs text-ink-300">
                {p.latestDeployment ? `${p.latestDeployment.state} · ${timeAgo(p.latestDeployment.ts)}` : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel p-5">
        <SectionTitle>Recent deployments</SectionTitle>
        <ul className="divide-y divide-ink-600/40 text-sm">
          {(data?.recentDeployments ?? []).map((d, i) => (
            <li key={i} className="flex items-center justify-between py-2">
              <span>{d.project}</span>
              <span className="flex items-center gap-2 text-xs text-ink-300">
                <span className={d.state === "ready" ? "pill-ok" : d.state === "error" ? "pill-err" : "pill-warn"}>{d.state}</span>
                {timeAgo(d.ts)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
