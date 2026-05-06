/**
 * Command menu (Cmd/Ctrl+K).
 *
 * Pure client-side fuzzy navigator over LaunchOps routes and the project
 * registry. No backend round-trip — the nav targets are static and predictable.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { PROJECTS } from "@/lib/projects";
import { cn } from "@/lib/cn";

type Item = {
  id: string;
  label: string;
  description?: string;
  to: string;
  group: string;
};

const ROUTE_ITEMS: Item[] = [
  { id: "dash", label: "Dashboard", to: "/ops/dashboard", group: "Pages" },
  { id: "proj", label: "Projects", to: "/ops/projects", group: "Pages" },
  { id: "gh", label: "GitHub center", to: "/ops/github", group: "Pages" },
  { id: "dep", label: "Deployments center", to: "/ops/deployments", group: "Pages" },
  { id: "cf", label: "Cloudflare", to: "/ops/cloudflare", group: "Pages" },
  { id: "vc", label: "Vercel", to: "/ops/vercel", group: "Pages" },
  { id: "api", label: "API health", to: "/ops/apis", group: "Pages" },
  { id: "logs", label: "Logs", to: "/ops/logs", group: "Pages" },
  { id: "an", label: "Analytics", to: "/ops/analytics", group: "Pages" },
  { id: "cl", label: "Changelogs", to: "/ops/changelogs", group: "Pages" },
  { id: "no", label: "Notes", to: "/ops/notes", group: "Pages" },
  { id: "ta", label: "Tasks", to: "/ops/tasks", group: "Pages" },
  { id: "in", label: "Incidents", to: "/ops/incidents", group: "Pages" },
  { id: "sec", label: "Security center", to: "/ops/security", group: "Pages" },
  { id: "au", label: "Audit log", to: "/ops/audit", group: "Pages" },
  { id: "set", label: "Settings", to: "/ops/settings", group: "Pages" },
];

const PROJECT_ITEMS: Item[] = PROJECTS.map((p) => ({
  id: `proj-${p.slug}`,
  label: p.name,
  description: p.blurb,
  to: `/ops/projects/${p.slug}`,
  group: "Projects",
}));

const ITEMS: Item[] = [...PROJECT_ITEMS, ...ROUTE_ITEMS];

export default function CommandMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter((i) =>
      `${i.label} ${i.description ?? ""} ${i.group}`.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of filtered) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  if (!open) return null;

  function pick(idx: number) {
    const target = filtered[idx];
    if (!target) return;
    onClose();
    navigate(target.to);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/80 backdrop-blur-sm px-4 pt-[10vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-ink-600/50 px-4 py-3">
          <Search className="h-4 w-4 text-ink-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(filtered.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(active);
              }
            }}
            placeholder="Type a project, page, or action…"
            className="w-full bg-transparent text-sm text-ink-100 outline-none"
          />
          <kbd className="rounded-md border border-ink-600 bg-ink-800/80 px-1.5 py-0.5 text-[10px] text-ink-300">
            Esc
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-300">
              No matches.
            </p>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="px-2 py-1">
                <p className="px-2 py-1 text-[10px] uppercase tracking-[0.28em] text-ink-300/70">
                  {group}
                </p>
                {items.map((item) => {
                  const idx = filtered.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => pick(idx)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition",
                        idx === active
                          ? "bg-ink-800/80 text-ink-100 ring-1 ring-gilt-700/50"
                          : "text-ink-200 hover:bg-ink-800/60",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{item.label}</p>
                        {item.description ? (
                          <p className="truncate text-xs text-ink-300">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
