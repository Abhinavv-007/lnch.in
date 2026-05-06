import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "ok" | "warn" | "err" | "gilt" | "info";

const TONE_RING: Record<Tone, string> = {
  neutral: "ring-ink-600/60",
  ok: "ring-emerald-700/50",
  warn: "ring-amber-700/50",
  err: "ring-red-700/50",
  gilt: "ring-gilt-700/60",
  info: "ring-sky-700/50",
};

const TONE_GLOW: Record<Tone, string> = {
  neutral: "from-ink-700/30 to-transparent",
  ok: "from-emerald-500/10 to-transparent",
  warn: "from-amber-500/10 to-transparent",
  err: "from-red-500/10 to-transparent",
  gilt: "from-gilt-500/10 to-transparent",
  info: "from-sky-500/10 to-transparent",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-ink-300",
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  err: "bg-red-400",
  gilt: "bg-gilt-300",
  info: "bg-sky-400",
};

export type StatCardProps = {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  /** Bottom-aligned status string + dot (e.g., "All systems operational"). */
  status?: string;
  className?: string;
  href?: string;
  onClick?: () => void;
};

export default function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
  status,
  className,
  href,
  onClick,
}: StatCardProps) {
  const Wrapper = href ? "a" : onClick ? "button" : "div";
  const props = href ? { href } : onClick ? { onClick, type: "button" as const } : {};
  return (
    <Wrapper
      {...(props as object)}
      className={cn(
        "panel relative overflow-hidden p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gilt-300/40",
        "ring-1",
        TONE_RING[tone],
        (href || onClick) && "hover:-translate-y-0.5 hover:border-gilt-700/60",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70",
          TONE_GLOW[tone],
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-ink-300">
            {icon}
            <span className="truncate">{label}</span>
          </div>
          <p className="mt-2 truncate font-serif text-3xl tracking-tight text-ink-100">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 truncate text-xs text-ink-300">{hint}</p>
          ) : null}
        </div>
      </div>
      {status ? (
        <div className="relative mt-4 flex items-center gap-2 text-[11px] text-ink-300">
          <span className={cn("h-1.5 w-1.5 rounded-full glow-pulse", TONE_DOT[tone])} />
          <span className="truncate">{status}</span>
        </div>
      ) : null}
    </Wrapper>
  );
}
