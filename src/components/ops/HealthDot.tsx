import { cn } from "@/lib/cn";

export type HealthState = "ok" | "warn" | "err" | "unknown" | "missing";

const COLOR: Record<HealthState, string> = {
  ok: "bg-emerald-400 text-emerald-300",
  warn: "bg-amber-400 text-amber-300",
  err: "bg-red-400 text-red-300",
  unknown: "bg-ink-300 text-ink-300",
  missing: "bg-ink-400 text-ink-300",
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
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", COLOR[state], className)}>
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full glow-pulse", COLOR[state])} />
      {label}
    </span>
  );
}
