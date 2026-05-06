import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Entry = { id: number; ts: number; actor: string | null; action: string; target: string | null; ip: string | null; meta: string | null };

export default function AuditCenter() {
  const [list, setList] = useState<Entry[] | null>(null);
  useEffect(() => {
    api.get<{ events: Entry[] }>("/api/ops/audit").then((r) => setList(r.events)).catch(() => setList([]));
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="audit" title="Audit log" description="Every admin action LaunchOps performs is recorded here." />
      <div className="panel p-5">
        <SectionTitle hint={`${list?.length ?? 0} most recent`}>Events</SectionTitle>
        <ul className="divide-y divide-ink-600/40 text-sm">
          {(list ?? []).map((e) => (
            <li key={e.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2">
              <span className="font-mono text-xs text-gilt-300">{e.action}</span>
              <span className="truncate text-ink-200">{e.target ?? "—"}</span>
              <span className="text-xs text-ink-300">{timeAgo(e.ts)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
