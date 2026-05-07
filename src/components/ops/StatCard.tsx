import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "ok" | "warn" | "err" | "gilt" | "info";

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted",
  ok: "bg-[var(--signal-ok)]",
  warn: "bg-[var(--signal-warn)]",
  err: "bg-[var(--signal-err)]",
  gilt: "bg-accent",
  info: "bg-[var(--signal-info)]",
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-fg",
  ok: "text-[var(--signal-ok)]",
  warn: "text-[var(--signal-warn)]",
  err: "text-[var(--signal-err)]",
  gilt: "text-accent",
  info: "text-[var(--signal-info)]",
};

export type StatCardProps = {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  /** Bottom-aligned status content + dot (e.g., "All systems operational"). */
  status?: ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
};

/**
 * Editorial poster stat card. Reads tone from CSS variables so it retones
 * cleanly in light/dark mode. The frame uses the `.poster-stat` primitive
 * (scalloped corners, dashed bg) for visual cohesion with the rest of the
 * poster system.
 */
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
        "poster-stat poster-stat--block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        (href || onClick) && "poster-stat--link",
        className,
      )}
    >
      <div className="flex items-center gap-2 poster-stat__label">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("poster-stat__value", TONE_TEXT[tone])}>{value}</p>
      {hint ? <p className="poster-stat__hint">{hint}</p> : null}
      {status ? (
        <div className="poster-stat__status">
          <span className={cn("poster-stat__dot glow-pulse", TONE_DOT[tone])} />
          <span className="truncate">{status}</span>
        </div>
      ) : null}
    </Wrapper>
  );
}
