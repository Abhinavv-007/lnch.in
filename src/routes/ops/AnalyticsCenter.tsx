import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import StatCard from "@/components/ops/StatCard";
import MissingIntegration from "@/components/ops/MissingIntegration";
import { api } from "@/lib/api";
import { compactNumber } from "@/lib/format";

type Bundle = {
  firebase: { configured: boolean; perProject: { slug: string; project: string; userCount: number | null; reason?: string }[] };
};

export default function AnalyticsCenter() {
  const [data, setData] = useState<Bundle | null>(null);
  useEffect(() => {
    api.get<Bundle>("/api/ops/analytics").then(setData).catch(() => setData(null));
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="analytics" title="Analytics" description="Aggregated user, traffic and feature signals across all projects." />
      {!data?.firebase.configured ? (
        <MissingIntegration
          title="Firebase not configured"
          reason="LaunchOps reads user counts via Firebase Auth admin SDK. Add per-project FIREBASE_* secrets."
          needs={["FIREBASE_<PROJECT>_PROJECT_ID", "FIREBASE_<PROJECT>_CLIENT_EMAIL", "FIREBASE_<PROJECT>_PRIVATE_KEY"]}
        />
      ) : (
        <section className="poster-stagger grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.firebase.perProject.map((p) => (
            <StatCard
              key={p.slug}
              label={p.project}
              value={p.userCount == null ? "—" : compactNumber(p.userCount)}
              tone={p.userCount == null ? "neutral" : "gilt"}
              status={p.reason ?? "users (Firebase Auth)"}
            />
          ))}
        </section>
      )}
      <div className="panel p-5">
        <SectionTitle hint="future">Per-project analytics</SectionTitle>
        <p className="text-sm text-fg-soft">
          Project-specific analytics (per Modih inbox counts, Clex transfer counts, Clex AI request counts, Driped scan stats) will populate once those projects expose admin endpoints. See each project's <em>Admin</em> tab.
        </p>
      </div>
    </div>
  );
}
