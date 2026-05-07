import { cn } from "@/lib/cn";

export type HealthState = "ok" | "warn" | "err" | "unknown" | "missing";

const COLOR: Record<HealthState, { dot: string; text: string }> = {
  ok: { dot: "bg-[var(--signal-ok)]", text: "text-[var(--signal-ok)]" },
  warn: { dot: "bg-[var(--signal-warn)]", text: "text-[var(--signal-warn)]" },
  err: { dot: "bg-[var(--signal-err)]", text: "text-[var(--signal-err)]" },
  unknown: { dot: "bg-muted", text: "text-muted" },
  missing: { dot: "bg-muted", text: "text-muted" },
};

export default function HealthDot({
  state,
  label,
  className,
}: {
  state: HealthState;
  label?: string;
  className?: string;
}) {
  const c = COLOR[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", c.text, className)}>
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full glow-pulse", c.dot)} />
      {label}
    </span>
  );
}
