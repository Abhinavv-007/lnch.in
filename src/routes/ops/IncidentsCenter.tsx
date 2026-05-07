import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import { api } from "@/lib/api";
import { PROJECTS } from "@/lib/projects";
import { timeAgo } from "@/lib/format";

type Incident = { id: number; project_slug: string | null; title: string; severity: string; status: "open" | "monitoring" | "resolved"; opened_at: number; resolved_at: number | null; notes: string | null };

export default function IncidentsCenter() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [draft, setDraft] = useState({ title: "", project_slug: "", severity: "minor", notes: "" });

  async function refresh() {
    const r = await api.get<{ incidents: Incident[] }>("/api/ops/incidents");
    setIncidents(r.incidents);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    if (!draft.title) return;
    await api.post("/api/ops/incidents", { ...draft, project_slug: draft.project_slug || null });
    setDraft({ title: "", project_slug: "", severity: "minor", notes: "" });
    refresh();
  }
  async function setStatus(id: number, status: "monitoring" | "resolved") {
    await api.patch(`/api/ops/incidents/${id}`, { status });
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="incidents" title="Incidents" description="Track outages and degraded states across projects." />
      <div className="panel p-5">
        <SectionTitle>Open incident</SectionTitle>
        <input className="input-base mb-2" placeholder="Title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        <div className="grid gap-2 md:grid-cols-3">
          <select className="input-base" value={draft.project_slug} onChange={(e) => setDraft((d) => ({ ...d, project_slug: e.target.value }))}>
            <option value="">Global</option>
            {PROJECTS.map((p) => (<option key={p.slug} value={p.slug}>{p.name}</option>))}
          </select>
          <select className="input-base" value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value }))}>
            <option value="minor">minor</option>
            <option value="major">major</option>
            <option value="critical">critical</option>
          </select>
          <button className="btn-primary" onClick={save} disabled={!draft.title}>Open</button>
        </div>
        <textarea className="input-base mt-2 min-h-[80px]" placeholder="Notes" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
      </div>
      <div className="panel p-5">
        <SectionTitle hint={`${incidents?.length ?? 0} total`}>Incidents</SectionTitle>
        <ul className="divide-rule text-sm">
          {(incidents ?? []).map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium">
                  <span className={i.severity === "critical" ? "pill-err" : i.severity === "major" ? "pill-warn" : "pill"}>{i.severity}</span>{" "}
                  <span className={i.status === "resolved" ? "pill-ok" : i.status === "monitoring" ? "pill-info" : "pill-err"}>{i.status}</span>{" "}
                  {i.title}
                </p>
                <p className="text-[11px] text-muted">{i.project_slug ?? "global"} · opened {timeAgo(i.opened_at)} {i.resolved_at ? `· resolved ${timeAgo(i.resolved_at)}` : ""}</p>
              </div>
              {i.status !== "resolved" ? (
                <div className="flex gap-2">
                  {i.status !== "monitoring" ? <button className="btn-ghost text-xs" onClick={() => setStatus(i.id, "monitoring")}>Monitoring</button> : null}
                  <button className="btn-primary text-xs" onClick={() => setStatus(i.id, "resolved")}>Resolve</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
