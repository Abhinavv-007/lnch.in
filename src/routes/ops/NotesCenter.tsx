import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import { api } from "@/lib/api";
import { PROJECTS } from "@/lib/projects";
import { timeAgo } from "@/lib/format";

type Note = { id: number; title: string; body: string; project_slug: string | null; tags: string | null; created_at: number; updated_at: number };

export default function NotesCenter() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "", project_slug: "", tags: "" });

  async function refresh() {
    const r = await api.get<{ notes: Note[] }>("/api/ops/notes");
    setNotes(r.notes);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    if (!draft.title) return;
    await api.post("/api/ops/notes", { ...draft, project_slug: draft.project_slug || null });
    setDraft({ title: "", body: "", project_slug: "", tags: "" });
    refresh();
  }
  async function remove(id: number) {
    await api.del(`/api/ops/notes/${id}`);
    refresh();
  }
  async function convertToTask(n: Note) {
    await api.post("/api/ops/tasks", { title: n.title, body: n.body, project_slug: n.project_slug, priority: 2, status: "open" });
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="notes" title="Notes" description="Per-project & global jottings. Promote any note to a task." />
      <div className="panel p-5">
        <SectionTitle>New note</SectionTitle>
        <input className="input-base mb-2" placeholder="Title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        <textarea className="input-base mb-2 min-h-[120px]" placeholder="Body (markdown)" value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
        <div className="grid gap-2 md:grid-cols-2">
          <select className="input-base" value={draft.project_slug} onChange={(e) => setDraft((d) => ({ ...d, project_slug: e.target.value }))}>
            <option value="">Global note</option>
            {PROJECTS.map((p) => (<option key={p.slug} value={p.slug}>{p.name}</option>))}
          </select>
          <input className="input-base" placeholder="tags, comma-separated" value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} />
        </div>
        <div className="mt-3 text-right">
          <button className="btn-primary" onClick={save} disabled={!draft.title}>Save</button>
        </div>
      </div>
      <div className="panel p-5">
        <SectionTitle hint={`${notes?.length ?? 0} total`}>All notes</SectionTitle>
        <ul className="divide-y divide-ink-600/40 text-sm">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium text-ink-100">{n.title}</p>
                <p className="line-clamp-2 text-xs text-ink-300">{n.body}</p>
                <p className="mt-1 text-[11px] text-ink-300">{n.project_slug ?? "global"} · {timeAgo(n.updated_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button className="btn-ghost text-xs" onClick={() => convertToTask(n)}>To task</button>
                <button className="btn-danger text-xs" onClick={() => remove(n.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
