import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import { api } from "@/lib/api";
import { PROJECTS } from "@/lib/projects";
import { timeAgo, shortHash } from "@/lib/format";

type Draft = { id: number; project_slug: string; title: string; body: string; status: string; updated_at: number };
type Commits = { repo: string; sha: string; message: string; author: string; ts: number }[];

export default function ChangelogCenter() {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [project, setProject] = useState(PROJECTS[0].slug);
  const [commits, setCommits] = useState<Commits>([]);
  const [draft, setDraft] = useState({ title: "", body: "" });
  async function refresh() {
    const r = await api.get<{ drafts: Draft[] }>("/api/ops/changelogs");
    setDrafts(r.drafts);
  }
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    api.get<{ commits: Commits }>(`/api/ops/github/commits?project=${project}&per_page=20`).then((r) => setCommits(r.commits)).catch(() => setCommits([]));
  }, [project]);

  function generate() {
    const title = `Changelog · ${PROJECTS.find((p) => p.slug === project)?.name ?? project}`;
    const lines = commits.slice(0, 12).map((c) => `- ${c.message.split("\n")[0]} (${shortHash(c.sha)})`);
    setDraft({ title, body: lines.join("\n") });
  }
  async function save() {
    await api.post("/api/ops/changelogs", { project_slug: project, title: draft.title, body: draft.body, status: "draft" });
    setDraft({ title: "", body: "" });
    refresh();
  }
  async function markPublished(id: number) {
    await api.patch(`/api/ops/changelogs/${id}`, { status: "published" });
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="changelogs" title="Changelogs & releases" description="Generate honest release notes from real commits." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle action={<button onClick={generate} className="btn-ghost">Generate from commits</button>}>
            New draft
          </SectionTitle>
          <label className="text-xs uppercase tracking-[0.22em] text-ink-300">Project</label>
          <select className="input-base mt-1 mb-2" value={project} onChange={(e) => setProject(e.target.value)}>
            {PROJECTS.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
          <input className="input-base mb-2" placeholder="Title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          <textarea className="input-base min-h-[160px]" placeholder="Body (markdown)" value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDraft({ title: "", body: "" })}>Reset</button>
            <button className="btn-primary" onClick={save} disabled={!draft.title || !draft.body}>Save draft</button>
          </div>
        </div>
        <div className="panel p-5">
          <SectionTitle>Recent commits ({project})</SectionTitle>
          <ul className="divide-y divide-ink-600/40 text-sm max-h-[420px] overflow-auto">
            {commits.map((c) => (
              <li key={c.sha} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2">
                <span className="font-mono text-xs text-gilt-300">{shortHash(c.sha)}</span>
                <span className="truncate">{c.message.split("\n")[0]}</span>
                <span className="text-xs text-ink-300">{timeAgo(c.ts)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="panel p-5">
        <SectionTitle hint={`${drafts?.length ?? 0} total`}>Drafts & releases</SectionTitle>
        <ul className="divide-y divide-ink-600/40 text-sm">
          {(drafts ?? []).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className={d.status === "published" ? "pill-ok" : "pill-warn"}>{d.status}</span>{" "}
                <span className="text-ink-100">{d.title}</span>{" "}
                <span className="text-xs text-ink-300">{d.project_slug} · {timeAgo(d.updated_at)}</span>
              </span>
              {d.status === "draft" ? (
                <button onClick={() => markPublished(d.id)} className="btn-ghost text-xs">Publish</button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
