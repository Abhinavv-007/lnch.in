import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Command, Search, Plus, Eye, Settings } from "lucide-react";
import { api } from "@/lib/api";
import ThemeToggle from "@/components/public/ThemeToggle";

type Session = { ok: boolean; user?: string; method?: "secret" | "session" };

export default function Topbar({ onCommand }: { onCommand: () => void }) {
  const [_session, setSession] = useState<Session | null>(null);
  const params = useParams<{ slug?: string }>();
  // When viewing a project detail, "View public" jumps straight to that slug;
  // otherwise it goes to the public landing.
  const publicHref = params.slug ? `/projects/${params.slug}` : "/";

  useEffect(() => {
    api
      .get<Session>("/api/auth/session")
      .then((s) => setSession(s))
      .catch(() => setSession({ ok: false }));
  }, []);

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-rule bg-paper/85 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile-only logo */}
        <Link to="/ops/dashboard" className="flex items-center gap-2 lg:hidden">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulseGlow rounded-full bg-accent" />
          </span>
          <span className="font-serif text-base text-fg">
            Launch<span className="text-accent">Ops</span>
          </span>
        </Link>

        <button
          onClick={onCommand}
          className="ml-auto flex flex-1 max-w-xl items-center gap-3 rounded-full border border-rule bg-paper-elev px-3.5 py-2 text-sm text-fg-soft transition hover:border-accent hover:text-fg"
        >
          <Search className="h-4 w-4 text-fg-soft" />
          <span className="truncate">Search projects, services, docs, run a command…</span>
          <kbd className="ml-auto hidden items-center gap-1 rounded-md border border-rule bg-paper-soft px-1.5 py-0.5 text-[10px] text-fg-soft md:flex">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>

        <ThemeToggle className="hidden sm:inline-flex" />
        <a
          href={publicHref}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-full border border-rule bg-paper-elev px-3 py-1.5 text-xs text-fg-soft hover:border-accent hover:text-accent md:inline-flex"
          title="See exactly what visitors see on the public page"
        >
          <Eye className="h-3.5 w-3.5" />
          View public
        </a>
        {/* Replaces the previous System-health + Notifications buttons:
            both routed nowhere and the user flagged them as broken icons.
            One Settings link that actually goes somewhere is the upgrade. */}
        <Link
          to="/ops/settings"
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-rule bg-paper-elev text-fg-soft hover:border-accent hover:text-accent md:inline-flex"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <Link
          to="/ops/tasks?new=1"
          className="hidden items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold sm:inline-flex"
          style={{ color: "var(--bg)" }}
        >
          <Plus className="h-3.5 w-3.5" /> New
        </Link>
      </div>
    </header>
  );
}
