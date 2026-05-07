import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  Github,
  Rocket,
  Cloud,
  Triangle,
  Activity,
  ScrollText,
  BarChart3,
  GitPullRequestArrow,
  StickyNote,
  CheckSquare,
  AlertTriangle,
  Shield,
  ClipboardList,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Item = { to: string; icon: typeof LayoutDashboard; label: string; hint?: string };

const PRIMARY: Item[] = [
  { to: "/ops/dashboard", icon: LayoutDashboard, label: "Overview" },
  { to: "/ops/projects", icon: Boxes, label: "Projects" },
  { to: "/ops/github", icon: Github, label: "GitHub" },
  { to: "/ops/deployments", icon: Rocket, label: "Deployments" },
];

const INTEGRATIONS: Item[] = [
  { to: "/ops/cloudflare", icon: Cloud, label: "Cloudflare" },
  { to: "/ops/vercel", icon: Triangle, label: "Vercel" },
  { to: "/ops/apis", icon: Activity, label: "APIs" },
  { to: "/ops/logs", icon: ScrollText, label: "Logs" },
  { to: "/ops/analytics", icon: BarChart3, label: "Analytics" },
];

const PRODUCTIVITY: Item[] = [
  { to: "/ops/changelogs", icon: GitPullRequestArrow, label: "Changelogs" },
  { to: "/ops/notes", icon: StickyNote, label: "Notes" },
  { to: "/ops/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/ops/incidents", icon: AlertTriangle, label: "Incidents" },
];

const ADMIN: Item[] = [
  { to: "/ops/security", icon: Shield, label: "Security" },
  { to: "/ops/audit", icon: ClipboardList, label: "Audit" },
  { to: "/ops/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-rule bg-paper-deep/80 pb-6 lg:flex">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-pulseGlow rounded-full bg-accent" />
          </span>
          <span className="font-serif text-[19px] tracking-tight text-fg">
            Launch<span className="text-accent">Ops</span>
          </span>
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-muted">
          private command center
        </p>
      </div>
      <nav className="scroll-smooth overflow-y-auto px-3">
        <Section label="Overview" items={PRIMARY} />
        <Section label="Integrations" items={INTEGRATIONS} />
        <Section label="Workflow" items={PRODUCTIVITY} />
        <Section label="Admin" items={ADMIN} />
      </nav>
      <div className="mt-auto px-5 pt-4 text-[11px] text-muted">
        <p className="font-mono">v0.1 · {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}

function Section({ label, items }: { label: string; items: Item[] }) {
  return (
    <div className="mb-6">
      <p className="px-2 pb-1.5 text-[10px] uppercase tracking-[0.28em] text-muted">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map(({ to, icon: Icon, label: l }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-paper-elev text-fg ring-1 ring-accent/50 shadow-gilt-sm"
                    : "text-fg-soft hover:bg-paper-elev hover:text-fg",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0 text-fg-soft group-hover:text-accent" />
              <span className="truncate">{l}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
