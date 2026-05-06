/**
 * Mobile bottom navigation for LaunchOps.
 *
 * Five top-level tabs sit on a glass bar pinned to the bottom; we deliberately
 * keep the count low to give touch targets enough room. Secondary destinations
 * are reachable via the in-page command menu and per-section sub-navigation.
 */
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  Activity,
  CheckSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { to: "/ops/dashboard", icon: LayoutDashboard, label: "Overview" },
  { to: "/ops/projects", icon: Boxes, label: "Projects" },
  { to: "/ops/apis", icon: Activity, label: "APIs" },
  { to: "/ops/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/ops/settings", icon: Settings, label: "Settings" },
];

export default function MobileNav() {
  return (
    <nav
      aria-label="LaunchOps mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-ink-600/40 bg-ink-950/85 px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md lg:hidden"
    >
      {ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[10px] font-medium tracking-wide transition",
              isActive
                ? "text-gilt-200 bg-ink-800/70 shadow-gilt-sm"
                : "text-ink-300 hover:text-ink-100",
            )
          }
        >
          <Icon className="h-5 w-5" />
          <span className="uppercase">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
