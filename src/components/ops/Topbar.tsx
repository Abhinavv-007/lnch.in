import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Command, Search, Activity, Plus } from "lucide-react";
import { api } from "@/lib/api";

type Session = { ok: boolean; user?: string; method?: "secret" | "session" };

export default function Topbar({ onCommand }: { onCommand: () => void }) {
  const [_session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    api
      .get<Session>("/api/auth/session")
      .then((s) => setSession(s))
      .catch(() => setSession({ ok: false }));
  }, []);

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-ink-600/30 bg-ink-950/70 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile-only logo */}
        <Link to="/ops/dashboard" className="flex items-center gap-2 lg:hidden">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulseGlow rounded-full bg-gilt-300" />
          </span>
          <span className="font-serif text-base">
            Launch<span className="text-gilt-300">Ops</span>
          </span>
        </Link>

        <button
          onClick={onCommand}
          className="ml-auto flex flex-1 max-w-xl items-center gap-3 rounded-full border border-ink-600 bg-ink-900/70 px-3.5 py-2 text-sm text-ink-300 transition hover:border-gilt-700/60 hover:text-ink-100"
        >
          <Search className="h-4 w-4 text-ink-300" />
          <span className="truncate">Search projects, services, docs, run a command…</span>
          <kbd className="ml-auto hidden items-center gap-1 rounded-md border border-ink-600 bg-ink-800/80 px-1.5 py-0.5 text-[10px] text-ink-300 md:flex">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>

        <button className="hidden h-9 w-9 items-center justify-center rounded-full border border-ink-600 bg-ink-900/70 text-ink-300 hover:text-gilt-200 md:inline-flex" title="System health">
          <Activity className="h-4 w-4" />
        </button>
        <button className="hidden h-9 w-9 items-center justify-center rounded-full border border-ink-600 bg-ink-900/70 text-ink-300 hover:text-gilt-200 md:inline-flex" title="Notifications">
          <Bell className="h-4 w-4" />
        </button>
        <Link
          to="/ops/tasks?new=1"
          className="hidden items-center gap-1.5 rounded-full bg-gilt-300 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-gilt-200 sm:inline-flex"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </Link>
      </div>
    </header>
  );
}
