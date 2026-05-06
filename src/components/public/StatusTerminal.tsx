import { useEffect, useState } from "react";

type ProjectSummary = {
  slug: string;
  name: string;
  health: { state: "ok" | "warn" | "err" | "unknown"; ok: number; targets: number };
  last24h: { p95LatencyMs: number | null; ok: number; probes: number };
  latestProbe: { latencyMs: number | null; ts: number; status: number | null } | null;
};

const STATE_LABEL: Record<ProjectSummary["health"]["state"], { text: string; className: string }> = {
  ok: { text: "online", className: "term-ok" },
  warn: { text: "degraded", className: "term-warn" },
  err: { text: "down", className: "term-err" },
  unknown: { text: "no data", className: "term-dim" },
};

function pad(s: string, len: number) {
  return s.length >= len ? s : s + " ".repeat(len - s.length);
}

/**
 * Faux terminal showing live `lnch status` output across every project. Used
 * directly under the public hero so visitors see real telemetry the moment
 * they land.
 */
export default function StatusTerminal({ projects }: { projects: ProjectSummary[] | null }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const items = projects ?? [];
  const healthy = items.filter((p) => p.health.state === "ok").length;
  const total = items.length;

  return (
    <div className="terminal w-full overflow-hidden p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 hidden md:inline">lnch.in — operator@launchops</span>
        </div>
        <span className="font-mono">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="space-y-1.5">
        <div>
          <span className="term-prompt">$</span>{" "}
          <span className="term-cmd">lnch status --all</span>
        </div>

        {items.length === 0 && (
          <div className="term-dim">loading project registry…</div>
        )}

        {items.map((p) => {
          const tag = STATE_LABEL[p.health.state];
          const lat =
            p.latestProbe?.latencyMs != null
              ? `${p.latestProbe.latencyMs}ms`
              : p.last24h.p95LatencyMs != null
                ? `${p.last24h.p95LatencyMs}ms p95`
                : "—";
          return (
            <div key={p.slug} className="flex flex-wrap items-center gap-x-4">
              <span className="text-fg">{pad(p.name, 11)}</span>
              <span className={tag.className}>● {pad(tag.text, 9)}</span>
              <span className="term-dim">probes {p.health.ok}/{p.health.targets}</span>
              <span className="term-dim">latency {lat}</span>
            </div>
          );
        })}

        {items.length > 0 && (
          <>
            <div className="mt-3">
              <span className="term-prompt">$</span>{" "}
              <span className="term-cmd">echo "summary"</span>
            </div>
            <div className="text-fg">
              {healthy}/{total} healthy &middot;{" "}
              <span className="term-dim">scrape every 5m &middot; data via /api/public/projects</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export type { ProjectSummary };
