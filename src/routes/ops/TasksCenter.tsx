import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import { api } from "@/lib/api";
import { PROJECTS } from "@/lib/projects";
import { timeAgo } from "@/lib/format";

type Task = { id: number; title: string; body: string | null; project_slug: string | null; status: "open" | "blocked" | "shipped" | "archived"; priority: number; tags: string | null; created_at: number; updated_at: number };
const STATUS = ["open", "blocked", "shipped", "archived"] as const;

export default function TasksCenter() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "", project_slug: "", priority: 2, tags: "" });
  const [filter, setFilter] = useState<"" | typeof STATUS[number]>("");

  async function refresh() {
    const r = await api.get<{ tasks: Task[] }>(`/api/ops/tasks${filter ? `?status=${filter}` : ""}`);
    setTasks(r.tasks);
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function save() {
    if (!draft.title) return;
    await api.post("/api/ops/tasks", { ...draft, project_slug: draft.project_slug || null, status: "open" });
    setDraft({ title: "", body: "", project_slug: "", priority: 2, tags: "" });
    refresh();
  }
  async function setStatus(id: number, status: Task["status"]) {
    await api.patch(`/api/ops/tasks/${id}`, { status });
    refresh();
  }
  async function remove(id: number) {
    await api.del(`/api/ops/tasks/${id}`);
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="tasks" title="Tasks" description="Open, blocked, shipped, archived. Link to project & priority." />
      <div className="panel p-5">
        <SectionTitle>New task</SectionTitle>
        <input className="input-base mb-2" placeholder="Title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        <textarea className="input-base mb-2 min-h-[100px]" placeholder="Description (optional)" value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
        <div className="grid gap-2 md:grid-cols-3">
          <select className="input-base" value={draft.project_slug} onChange={(e) => setDraft((d) => ({ ...d, project_slug: e.target.value }))}>
            <option value="">Global</option>
            {PROJECTS.map((p) => (<option key={p.slug} value={p.slug}>{p.name}</option>))}
          </select>
          <select className="input-base" value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))}>
            <option value={1}>P1 · urgent</option>
            <option value={2}>P2 · normal</option>
            <option value={3}>P3 · later</option>
          </select>
          <input className="input-base" placeholder="tags" value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} />
        </div>
        <div className="mt-3 text-right">
          <button className="btn-primary" onClick={save} disabled={!draft.title}>Add task</button>
        </div>
      </div>
      <div className="panel p-5">
        <SectionTitle hint={`${tasks?.length ?? 0} shown`} action={
          <select className="input-base" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="">All</option>
            {STATUS.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        }>Tasks</SectionTitle>
        <ul className="divide-rule text-sm">
          {(tasks ?? []).map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium text-fg">
                  <span className={t.priority === 1 ? "pill-err" : t.priority === 2 ? "pill-warn" : "pill"}>P{t.priority}</span>{" "}
                  <span className={t.status === "shipped" ? "pill-ok" : t.status === "blocked" ? "pill-err" : "pill-info"}>{t.status}</span>{" "}
                  {t.title}
                </p>
                <p className="text-[11px] text-fg-soft">{t.project_slug ?? "global"} · {timeAgo(t.updated_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {t.status !== "shipped" ? (
                  <button className="btn-ghost text-xs" onClick={() => setStatus(t.id, "shipped")}>Ship</button>
                ) : null}
                {t.status !== "blocked" ? (
                  <button className="btn-ghost text-xs" onClick={() => setStatus(t.id, "blocked")}>Block</button>
                ) : null}
                <button className="btn-danger text-xs" onClick={() => remove(t.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
