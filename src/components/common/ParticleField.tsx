import { useEffect, useRef } from "react";

/**
 * Canvas-backed background particles. Replaces the older CursorGlow which
 * was painting a radial mask over the page. Inspired by the clex-ai /
 * trgt.in interactive gold-dust field — particles drift with their own
 * velocity, get repelled when the cursor passes near, and have a tiny
 * z-depth (rendered as size + alpha modulation) so the field reads as a
 * 3D layer rather than flat dots.
 *
 * Notes:
 *   - Density scales with viewport area; clamped to keep mobile cheap.
 *   - Pointer interaction is opt-out via `prefers-reduced-motion`.
 *   - Painted at devicePixelRatio (capped at 2) so the dots stay crisp.
 *   - Reads the gilt accent and bg from CSS custom properties so it retones
 *     in light mode without JS.
 */
export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;
    let raf = 0;

    const fitCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fitCanvas();

    // Density scales with viewport. Clamped so we never blow the budget on
    // small screens or 4K displays.
    const targetDensity = Math.min(
      180,
      Math.max(60, Math.round((width * height) / 18000)),
    );

    type P = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      depth: number; // 0..1; deeper = smaller + dimmer
      tw: number; // twinkle phase
    };

    const particles: P[] = Array.from({ length: targetDensity }, () => {
      const depth = Math.random();
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18 * (1 - depth * 0.6),
        vy: (Math.random() - 0.5) * 0.18 * (1 - depth * 0.6),
        size: 0.6 + Math.random() * 1.6 * (1 - depth * 0.7),
        depth,
        tw: Math.random() * Math.PI * 2,
      };
    });

    const mouse = { x: -9999, y: -9999, active: false };
    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };

    if (!reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerleave", onLeave, { passive: true });
    }
    window.addEventListener("resize", fitCanvas);

    // Read theme tokens from CSS so we follow light/dark mode.
    const readTheme = () => {
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue("--gilt").trim() || "#d9c57f";
      const accentSoft = css.getPropertyValue("--gilt-soft").trim() || "#e6d9a4";
      return { accent, accentSoft };
    };
    let theme = readTheme();
    const themeObs = new MutationObserver(() => (theme = readTheme()));
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const FORCE_RADIUS = 140;
    const TWINKLE_SPEED = 0.04;

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < FORCE_RADIUS * FORCE_RADIUS) {
            const dist = Math.sqrt(dist2) || 1;
            const force = (FORCE_RADIUS - dist) / FORCE_RADIUS;
            // Foreground particles react faster than deep ones — gives the
            // crowd a parallax depth feel as the cursor passes.
            const reactivity = 0.45 * (1 - p.depth * 0.55);
            p.vx -= (dx / dist) * force * reactivity;
            p.vy -= (dy / dist) * force * reactivity;
          }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;

        // Wrap around edges so the field never depletes.
        if (p.x > width + 4) p.x = -4;
        else if (p.x < -4) p.x = width + 4;
        if (p.y > height + 4) p.y = -4;
        else if (p.y < -4) p.y = height + 4;

        p.tw += TWINKLE_SPEED * (0.6 + p.depth);

        const flicker = 0.55 + Math.sin(p.tw) * 0.35;
        const baseAlpha = 0.18 + (1 - p.depth) * 0.5;
        const alpha = Math.max(0.05, Math.min(0.92, baseAlpha * flicker));
        const radius = p.size;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.depth < 0.45 ? theme.accentSoft : theme.accent;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(tick);
    };

    if (reduced) {
      // One static frame for accessibility — still gives the dotted field.
      tick();
    } else {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", fitCanvas);
      themeObs.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ mixBlendMode: "plus-lighter" }}
    />
  );
}
