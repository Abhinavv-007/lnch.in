/**
 * Three pulsing mono dots used in place of a static "Loading…" text. Each
 * bullet animates with a staggered delay so the row reads as a live tick.
 * Respects `prefers-reduced-motion` via `globals.css` (animation disabled,
 * dots dimmed).
 */
export default function DotPulse({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-muted" +
        (className ? ` ${className}` : "")
      }
      aria-live="polite"
    >
      {label ? <span className="mr-1">{label}</span> : null}
      <span className="dot-pulse__bullet">·</span>
      <span className="dot-pulse__bullet" style={{ animationDelay: "0.16s" }}>
        ·
      </span>
      <span className="dot-pulse__bullet" style={{ animationDelay: "0.32s" }}>
        ·
      </span>
    </span>
  );
}
