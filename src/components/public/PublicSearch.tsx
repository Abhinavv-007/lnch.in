/**
 * Public cross-project search.
 *
 * Mounted in `PublicHeader`. Hits `/api/public/search?q=…` (debounced 180ms),
 * renders an editorial-style results dropdown grouped by kind (project /
 * task / changelog / commit), and routes the user to the right surface on
 * Enter or click.
 *
 * Keyboard:
 *   - `/`              focus the input from anywhere on the page
 *   - `ArrowUp/Down`   move highlight
 *   - `Enter`          open highlighted result (or first result)
 *   - `Esc`            close dropdown / blur input
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, GitCommit, ListChecks, Newspaper, Boxes } from "lucide-react";

type ResultKind = "project" | "task" | "changelog" | "commit";

type Result = {
  kind: ResultKind;
  score: number;
  title: string;
  detail?: string;
  href: string;
  project?: string;
  ts?: number;
};

type Resp = {
  q: string;
  results: Result[];
  counts: {
    total: number;
    projects?: number;
    tasks?: number;
    changelog?: number;
    commits?: number;
  };
  generatedAt: number;
};

const KIND_ICON: Record<ResultKind, React.ComponentType<{ className?: string }>> = {
  project: Boxes,
  task: ListChecks,
  changelog: Newspaper,
  commit: GitCommit,
};

const KIND_LABEL: Record<ResultKind, string> = {
  project: "project",
  task: "shipped",
  changelog: "changelog",
  commit: "commit",
};

export default function PublicSearch() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [resp, setResp] = useState<Resp | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // 180ms debounce
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 180);
    return () => window.clearTimeout(id);
  }, [q]);

  // fetch
  useEffect(() => {
    if (debouncedQ.length < 2) {
      setResp(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`/api/public/search?q=${encodeURIComponent(debouncedQ)}`, {
          credentials: "omit",
        });
        if (!r.ok) return;
        const body = (await r.json()) as Resp;
        if (!cancelled) {
          setResp(body);
          setHighlight(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  // global "/" focus shortcut + click-outside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = e.target as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const results = useMemo<Result[]>(() => resp?.results ?? [], [resp]);

  const grouped = useMemo(() => {
    const buckets: Record<ResultKind, Result[]> = {
      project: [],
      task: [],
      changelog: [],
      commit: [],
    };
    for (const r of results) buckets[r.kind].push(r);
    return buckets;
  }, [results]);

  const flat = useMemo(
    () => [...grouped.project, ...grouped.changelog, ...grouped.task, ...grouped.commit],
    [grouped],
  );

  const followResult = useCallback(
    (r: Result) => {
      setOpen(false);
      setQ("");
      if (r.href.startsWith("http")) {
        window.open(r.href, "_blank", "noreferrer");
      } else {
        navigate(r.href);
      }
    },
    [navigate],
  );

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(flat.length - 1, h + 1));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      const r = flat[highlight] ?? flat[0];
      if (r) {
        e.preventDefault();
        followResult(r);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = open && q.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full md:w-72">
      <div className="flex items-center gap-2 rounded-full border border-rule bg-paper-elev px-3 py-1.5 text-xs transition focus-within:border-accent">
        <Search className="h-3.5 w-3.5 text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search projects, commits, releases…"
          aria-label="Search across projects"
          className="flex-1 bg-transparent text-fg outline-none placeholder:text-muted"
        />
        <kbd className="hidden rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[10px] text-muted md:inline">
          /
        </kbd>
      </div>

      {showDropdown ? (
        <div
          role="listbox"
          aria-label="Search results"
          className="absolute right-0 left-0 z-40 mt-2 max-h-[28rem] overflow-y-auto rounded-2xl border border-rule bg-paper shadow-xl backdrop-blur md:left-auto md:w-[26rem]"
        >
          {loading && results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs uppercase tracking-[0.28em] text-muted">
              searching…
            </div>
          ) : null}

          {!loading && results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs uppercase tracking-[0.28em] text-muted">
              no matches for "{q}"
            </div>
          ) : null}

          {(["project", "changelog", "task", "commit"] as ResultKind[]).map((kind) => {
            const bucket = grouped[kind];
            if (bucket.length === 0) return null;
            return (
              <Group key={kind} kind={kind}>
                {bucket.map((r) => {
                  const idx = flat.indexOf(r);
                  return (
                    <ResultRow
                      key={`${kind}-${idx}-${r.href}`}
                      result={r}
                      active={idx === highlight}
                      onClick={() => followResult(r)}
                      onMouseEnter={() => setHighlight(idx)}
                    />
                  );
                })}
              </Group>
            );
          })}

          <div className="flex items-center justify-between border-t border-rule px-3 py-2 text-[10px] uppercase tracking-[0.28em] text-muted">
            <span>{resp?.counts.total ?? 0} results</span>
            <span>↵ open · ↑↓ move · esc close</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Group({ kind, children }: { kind: ResultKind; children: React.ReactNode }) {
  const Icon = KIND_ICON[kind];
  return (
    <div className="border-b border-rule last:border-b-0">
      <div className="flex items-center gap-2 px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.28em] text-muted">
        <Icon className="h-3 w-3" />
        {KIND_LABEL[kind]}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ResultRow({
  result,
  active,
  onClick,
  onMouseEnter,
}: {
  result: Result;
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  const Icon = KIND_ICON[result.kind];
  const inner = (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-fg">{result.title}</p>
        {result.detail ? (
          <p className="truncate text-xs text-fg-soft">{result.detail}</p>
        ) : null}
      </div>
      {result.project ? (
        <span className="ml-2 shrink-0 rounded-full border border-rule bg-paper-elev px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {result.project}
        </span>
      ) : null}
    </div>
  );

  const baseClass = `block w-full cursor-pointer px-3 py-2 text-left transition ${
    active ? "bg-accent-soft text-fg" : "hover:bg-accent-soft"
  }`;

  if (result.href.startsWith("http")) {
    return (
      <a
        role="option"
        aria-selected={active}
        href={result.href}
        target="_blank"
        rel="noreferrer"
        className={baseClass}
        onMouseEnter={onMouseEnter}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link
      role="option"
      aria-selected={active}
      to={result.href}
      onClick={(e) => {
        // Use the controlled handler (closes dropdown, clears query)
        e.preventDefault();
        onClick();
      }}
      onMouseEnter={onMouseEnter}
      className={baseClass}
    >
      {inner}
    </Link>
  );
}
