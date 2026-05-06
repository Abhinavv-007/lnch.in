import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "@/components/ops/Sidebar";
import MobileNav from "@/components/ops/MobileNav";
import Topbar from "@/components/ops/Topbar";
import CommandMenu from "@/components/ops/CommandMenu";
import { api, ApiError } from "@/lib/api";
import { pinThemeForOps } from "@/lib/theme";

type Session = { ok: boolean };

export default function OpsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.get<Session>("/api/auth/session");
        if (cancelled) return;
        if (s.ok) setAuthChecked(true);
        else throw new ApiError(401, s, "unauth");
      } catch {
        if (cancelled) return;
        const next = encodeURIComponent(location.pathname + location.search);
        navigate(`/ops/login?next=${next}`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, navigate]);

  // Force the legacy ink palette while inside /ops — light mode is intentionally
  // a public-surface-only feature.
  useEffect(() => {
    return pinThemeForOps();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!authChecked) {
    return (
      <div className="bg-stage flex min-h-screen items-center justify-center">
        <div className="panel-soft px-6 py-4 text-sm text-ink-200">
          Verifying session…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-stage flex min-h-screen">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col px-4 pb-24 md:px-6 lg:pb-8">
        <Topbar onCommand={() => setCmdOpen(true)} />
        <main className="min-w-0 flex-1 pb-10">
          <Outlet />
        </main>
      </div>
      <MobileNav />
      <CommandMenu open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
