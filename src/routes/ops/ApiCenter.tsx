import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import StatCard from "@/components/ops/StatCard";
import HealthDot from "@/components/ops/HealthDot";
import { api } from "@/lib/api";
import { PROJECTS, PROJECTS_BY_SLUG } from "@/lib/projects";
import { cn } from "@/lib/cn";

type Probe = { project: string; target: string; ok: boolean; latencyMs: number | null; status: number | null };

type Consumer = {
  ip: string;
  calls: number;
  blocked: number;
  errors: number;
  lastSeen: number;
  rlPeak: number;
  rlLimit: number;
  p95LatencyMs: number | null;
  topEndpoint: string | null;
  topProject: string | null;
  ua: string | null;
};

type ConsumersResponse = {
  window: { hours: number; fromTs: number; toTs: number };
  totals: { calls: number; ips: number; blocked: number; errors: number };
  consumers: Consumer[];
  byProject: { slug: string; calls: number; blocked: number }[];
  byEndpoint: { endpoint: string; calls: number; blocked: number; avgLatencyMs: number | null }[];
  byStatus: { status: number; calls: number }[];
  note?: string;
};

type TrafficBucket = { ts: number; calls: number; blocked: number; errors: number };
type TrafficResponse = {
  window: { hours: number; fromTs: number; toTs: number };
  buckets: TrafficBucket[];
  note?: string;
};

const HOUR_OPTS: { label: string; value: number }[] = [
  { label: "24h", value: 24 },
  { label: "7d", value: 168 },
  { label: "30d", value: 720 },
];

function fmtRelative(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function projectAccent(slug: string | null): string {
  if (!slug) return "text-fg-soft";
  return PROJECTS_BY_SLUG[slug]?.accent ?? "text-fg-soft";
}

function projectLabel(slug: string | null): string {
  if (!slug) return "—";
  return PROJECTS_BY_SLUG[slug]?.name ?? slug;
}

export default function ApiCenter() {
  const [probes, setProbes] = useState<Probe[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [hours, setHours] = useState(168);
  const [slug, setSlug] = useState<string>("");
  const [consumers, setConsumers] = useState<ConsumersResponse | null>(null);
  const [traffic, setTraffic] = useState<TrafficResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function refreshProbes() {
    setBusy(true);
    try {
      const r = await api.post<{ probes: Probe[] }>("/api/ops/health/run", {});
      setProbes(r.probes);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    api
      .get<{ probes: Probe[] }>("/api/ops/health")
      .then((r) => setProbes(r.probes))
      .catch(() => setProbes([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ hours: String(hours) });
    if (slug) qs.set("slug", slug);
    Promise.all([
      api.get<ConsumersResponse>(`/api/ops/public-consumers?${qs.toString()}`).catch(() => null),
      api.get<TrafficResponse>(`/api/ops/public-traffic?${qs.toString()}`).catch(() => null),
    ]).then(([c, t]) => {
      if (cancelled) return;
      setConsumers(c);
      setTraffic(t);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [hours, slug]);

  const ok = probes?.filter((p) => p.ok).length ?? 0;
  const total = probes?.length ?? 0;
  const blockedPct = useMemo(() => {
    const c = consumers?.totals?.calls ?? 0;
    if (!c) return 0;
    return Math.round(((consumers?.totals.blocked ?? 0) / c) * 100);
  }, [consumers]);
  const peakBucket = useMemo(() => {
    if (!traffic?.buckets?.length) return 0;
    return Math.max(...traffic.buckets.map((b) => b.calls));
  }, [traffic]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="api center"
        title="APIs"
        description="Public API consumers, per-project traffic, and live health probes — one cross-project view."
        actions={
          <button onClick={refreshProbes} className="btn-primary" disabled={busy}>
            {busy ? "Probing…" : "Run probes"}
          </button>
        }
      />

      <section className="poster-stagger grid gap-3 md:grid-cols-4">
        <StatCard
          label="Probes"
          value={total}
          hint={`${ok}/${total} healthy`}
          tone={total === 0 ? "neutral" : ok === total ? "ok" : ok > 0 ? "warn" : "err"}
        />
        <StatCard
          label="Public calls"
          value={consumers?.totals.calls ?? 0}
          hint={`${HOUR_OPTS.find((h) => h.value === hours)?.label ?? `${hours}h`} · ${consumers?.totals.ips ?? 0} unique IPs`}
          tone="info"
        />
        <StatCard
          label="Blocked (429)"
          value={consumers?.totals.blocked ?? 0}
          hint={blockedPct ? `${blockedPct}% of total` : "no rate-limit hits"}
          tone={blockedPct > 5 ? "warn" : "neutral"}
        />
        <StatCard
          label="5xx errors"
          value={consumers?.totals.errors ?? 0}
          hint={consumers?.totals.errors ? "investigate logs" : "none"}
          tone={consumers?.totals.errors ? "err" : "ok"}
        />
      </section>

      <div className="panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Public traffic</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="rounded-md border border-rule bg-paper-elev px-2 py-1 text-xs"
            >
              <option value="">All projects</option>
              {PROJECTS.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="flex overflow-hidden rounded-md border border-rule text-xs">
              {HOUR_OPTS.map((h) => (
                <button
                  key={h.value}
                  onClick={() => setHours(h.value)}
                  className={cn(
                    "px-2 py-1 transition",
                    hours === h.value
                      ? "bg-accent/15 text-accent"
                      : "bg-paper-elev text-fg-soft hover:text-fg",
                  )}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <TrafficBars buckets={traffic?.buckets ?? []} peak={peakBucket} />
        {loading ? (
          <p className="text-xs text-muted">loading…</p>
        ) : !traffic?.buckets?.length ? (
          <p className="text-xs text-muted">No public traffic in this window yet.</p>
        ) : null}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle>By project</SectionTitle>
          {consumers?.byProject?.length ? (
            <ul className="divide-rule text-sm">
              {consumers.byProject.map((row) => (
                <li key={row.slug} className="flex items-center justify-between gap-3 py-2">
                  <span className={cn("min-w-0 truncate", projectAccent(row.slug))}>
                    {projectLabel(row.slug)}
                  </span>
                  <span className="text-xs text-fg-soft">
                    {row.calls.toLocaleString()} calls
                    {row.blocked > 0 ? (
                      <span className="ml-2 text-[var(--signal-warn)]">{row.blocked} blocked</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-xs text-muted">No project-scoped traffic yet.</p>
          )}
        </div>

        <div className="panel p-5">
          <SectionTitle>By endpoint</SectionTitle>
          {consumers?.byEndpoint?.length ? (
            <ul className="divide-rule text-sm">
              {consumers.byEndpoint.slice(0, 8).map((row) => (
                <li key={row.endpoint} className="flex items-center justify-between gap-3 py-2">
                  <span
                    className="min-w-0 truncate font-mono text-xs text-fg-soft"
                    title={row.endpoint}
                  >
                    {row.endpoint}
                  </span>
                  <span className="whitespace-nowrap text-xs text-fg-soft">
                    {row.calls.toLocaleString()} · {row.avgLatencyMs ?? "—"}ms
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-xs text-muted">No endpoint traffic yet.</p>
          )}
        </div>
      </section>

      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Top consumers (IP)</SectionTitle>
          <span className="text-[10px] uppercase tracking-[0.28em] text-muted">
            {slug ? `${projectLabel(slug)} only · ` : ""}
            {HOUR_OPTS.find((h) => h.value === hours)?.label ?? `${hours}h`}
          </span>
        </div>
        {consumers?.consumers?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 pr-3">IP</th>
                  <th className="py-2 pr-3">Calls</th>
                  <th className="py-2 pr-3">Blocked</th>
                  <th className="py-2 pr-3">Top endpoint</th>
                  <th className="py-2 pr-3">Top project</th>
                  <th className="py-2 pr-3">p95</th>
                  <th className="py-2 pr-3">Last seen</th>
                  <th className="py-2 pr-3">Bucket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {consumers.consumers.map((c) => (
                  <tr key={c.ip}>
                    <td className="py-2 pr-3 font-mono">{c.ip}</td>
                    <td className="py-2 pr-3">{c.calls.toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      {c.blocked > 0 ? (
                        <span className="text-[var(--signal-warn)]">{c.blocked}</span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td
                      className="max-w-[24ch] truncate py-2 pr-3 font-mono text-fg-soft"
                      title={c.topEndpoint ?? undefined}
                    >
                      {c.topEndpoint ?? "—"}
                    </td>
                    <td className={cn("py-2 pr-3", projectAccent(c.topProject))}>
                      {projectLabel(c.topProject)}
                    </td>
                    <td className="py-2 pr-3">{c.p95LatencyMs ?? "—"}ms</td>
                    <td className="py-2 pr-3 text-muted">{fmtRelative(c.lastSeen)}</td>
                    <td className="py-2 pr-3 font-mono text-muted">
                      {c.rlPeak}/{c.rlLimit || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-2 text-xs text-muted">
            No public-API traffic recorded yet. Anonymous calls to{" "}
            <code className="font-mono">/api/public/**</code> will appear here as they happen.
          </p>
        )}
      </div>

      <div className="panel p-5">
        <SectionTitle>All probes</SectionTitle>
        <ul className="divide-rule text-sm">
          {(probes ?? []).map((p) => {
            const proj = PROJECTS_BY_SLUG[p.project];
            return (
              <li key={p.target} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className={proj?.accent ?? "text-fg"}>{proj?.name ?? p.project}</span>{" "}
                  <span className="font-mono text-xs text-muted">{p.target}</span>
                </span>
                <span className="flex items-center gap-3 text-xs">
                  <span className="text-fg-soft">
                    {p.latencyMs ?? "—"}ms · {p.status ?? "—"}
                  </span>
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

function TrafficBars({ buckets, peak }: { buckets: TrafficBucket[]; peak: number }) {
  if (!buckets.length || peak <= 0) {
    return (
      <div
        className="h-24 rounded-md border border-dashed border-rule bg-paper-elev/30"
        aria-hidden
      />
    );
  }
  const maxBars = 96;
  const slice = buckets.length > maxBars ? buckets.slice(buckets.length - maxBars) : buckets;
  return (
    <div
      className="flex h-24 items-end gap-[2px]"
      role="img"
      aria-label="Public API traffic per hour"
    >
      {slice.map((b) => {
        const total = b.calls;
        const blocked = b.blocked;
        const errors = b.errors;
        const ok = Math.max(0, total - blocked - errors);
        const h = Math.max(2, Math.round((total / peak) * 96));
        const okH = Math.round((ok / Math.max(1, total)) * h);
        const blockedH = Math.round((blocked / Math.max(1, total)) * h);
        const errH = Math.max(0, h - okH - blockedH);
        return (
          <div
            key={b.ts}
            title={`${new Date(b.ts * 1000).toUTCString()} — ${total} calls (${blocked} blocked, ${errors} 5xx)`}
            className="flex flex-1 flex-col-reverse"
            style={{ minWidth: 2 }}
          >
            <div className="bg-accent/70" style={{ height: `${okH}px` }} />
            <div className="bg-[var(--signal-warn)]/70" style={{ height: `${blockedH}px` }} />
            <div className="bg-[var(--signal-err)]/70" style={{ height: `${errH}px` }} />
          </div>
        );
      })}
    </div>
  );
}
