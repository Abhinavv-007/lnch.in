import { useEffect } from "react";

/**
 * Tracks the cursor position and writes it to CSS custom properties on
 * `<html>`, then renders an additive radial highlight overlay that follows
 * the pointer. The dotted paper grid background gets a subtle brightening
 * near the cursor without occluding text (uses `mix-blend-mode: plus-lighter`).
 *
 * Honors `prefers-reduced-motion`: when enabled, the listener is never
 * attached and the overlay is hidden via globals.css.
 */
export default function CursorGlow() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let pendingX = window.innerWidth / 2;
    let pendingY = window.innerHeight / 2;

    const flush = () => {
      raf = 0;
      const root = document.documentElement;
      root.style.setProperty("--cursor-x", `${pendingX}px`);
      root.style.setProperty("--cursor-y", `${pendingY}px`);
    };

    const onMove = (e: PointerEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (!raf) raf = requestAnimationFrame(flush);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div aria-hidden className="cursor-glow" />;
}
