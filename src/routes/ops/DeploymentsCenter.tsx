import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import StatCard from "@/components/ops/StatCard";
import MissingIntegration from "@/components/ops/MissingIntegration";
import { api } from "@/lib/api";
import { shortHash, timeAgo } from "@/lib/format";

type Bundle = {
  cloudflare: {
    configured: boolean;
    deployments: { project: string; state: string; sha?: string; ts: number; url?: string }[];
  };
  vercel: {
    configured: boolean;
    deployments: { project: string; state: string; sha?: string; ts: number; url?: string; target?: string }[];
  };
  totals: { last24h: number; failed24h: number };
};

export default function DeploymentsCenter() {
  const [data, setData] = useState<Bundle | null>(null);
  useEffect(() => {
    api.get<Bundle>("/api/ops/deployments").then(setData).catch(() => setData(null));
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="deployments" title="Deployment center" description="Cloudflare Pages and Vercel deploys, side by side." />
      <section className="poster-stagger grid gap-3 md:grid-cols-3">
        <StatCard label="Last 24h" value={data?.totals.last24h ?? "…"} tone="gilt" />
        <StatCard label="Failed" value={data?.totals.failed24h ?? "…"} tone={data?.totals.failed24h ? "warn" : "ok"} />
        <StatCard label="Sources" value={`${data?.cloudflare.configured ? "CF" : ""} ${data?.vercel.configured ? "Vercel" : ""}`.trim() || "—"} tone="neutral" />
      </section>
      <ProviderBlock
        title="Cloudflare Pages"
        configured={data?.cloudflare.configured}
        deployments={data?.cloudflare.deployments ?? []}
        missingNeeds={["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]}
      />
      <ProviderBlock
        title="Vercel"
        configured={data?.vercel.configured}
        deployments={data?.vercel.deployments ?? []}
        missingNeeds={["VERCEL_TOKEN"]}
      />
    </div>
  );
}

function ProviderBlock({
  title,
  configured,
  deployments,
  missingNeeds,
}: {
  title: string;
  configured: boolean | undefined;
  deployments: { project: string; state: string; sha?: string; ts: number; url?: string }[];
  missingNeeds: string[];
}) {
  if (configured === false) {
    return (
      <MissingIntegration
        title={`${title} not connected`}
        reason={`Add ${missingNeeds.join(" + ")} to surface deployments here.`}
        needs={missingNeeds}
      />
    );
  }
  return (
    <div className="panel p-5">
      <SectionTitle hint={configured ? `${deployments.length} recent` : "loading"}>{title}</SectionTitle>
      <ul className="divide-rule text-sm">
        {deployments.length === 0 ? (
          <li className="py-2 text-fg-soft">No deployments to show.</li>
        ) : (
          deployments.map((d, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={
                    d.state === "ready" || d.state === "success"
                      ? "pill-ok"
                      : d.state === "error" || d.state === "failure"
                        ? "pill-err"
                        : "pill-warn"
                  }
                >
                  {d.state}
                </span>
                <span className="truncate">{d.project}</span>
                <span className="font-mono text-xs text-muted">{shortHash(d.sha)}</span>
              </span>
              <span className="text-xs text-muted">{timeAgo(d.ts)}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
