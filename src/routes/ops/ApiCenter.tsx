import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import StatCard from "@/components/ops/StatCard";
import HealthDot from "@/components/ops/HealthDot";
import { api } from "@/lib/api";
import { PROJECTS_BY_SLUG } from "@/lib/projects";

type Probe = { project: string; target: string; ok: boolean; latencyMs: number | null; status: number | null };

export default function ApiCenter() {
  const [probes, setProbes] = useState<Probe[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try {
      const r = await api.post<{ probes: Probe[] }>("/api/ops/health/run", {});
      setProbes(r.probes);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    api.get<{ probes: Probe[] }>("/api/ops/health").then((r) => setProbes(r.probes)).catch(() => setProbes([]));
  }, []);
  const ok = probes?.filter((p) => p.ok).length ?? 0;
  const total = probes?.length ?? 0;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="api center"
        title="APIs"
        description="Probe every health endpoint we know about, watch latency, catch silent regressions."
        actions={
          <button onClick={refresh} className="btn-primary" disabled={busy}>
            {busy ? "Probing…" : "Run probes"}
          </button>
        }
      />
      <section className="poster-stagger grid gap-3 md:grid-cols-3">
        <StatCard label="Probes" value={total} tone="gilt" />
        <StatCard label="Healthy" value={`${ok}/${total}`} tone={total === 0 ? "neutral" : ok === total ? "ok" : ok > 0 ? "warn" : "err"} />
        <StatCard label="Avg latency" value={(probes && probes.length ? Math.round(probes.reduce((s, p) => s + (p.latencyMs ?? 0), 0) / probes.length) : 0) + "ms"} tone="info" />
      </section>
      <div className="panel p-5">
        <SectionTitle>All probes</SectionTitle>
        <ul className="divide-rule text-sm">
          {(probes ?? []).map((p) => {
            const proj = PROJECTS_BY_SLUG[p.project];
            return (
              <li key={p.target} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className={proj?.accent ?? "text-fg"}>{proj?.name ?? p.project}</span>{" "}
                  <span className="font-mono text-xs text-fg-soft">{p.target}</span>
                </span>
                <span className="flex items-center gap-3 text-xs">
                  <span className="text-fg-soft">{p.latencyMs ?? "—"}ms · {p.status ?? "—"}</span>
                  <HealthDot state={p.ok ? "ok" : "err"} label={p.ok ? "ok" : "down"} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
