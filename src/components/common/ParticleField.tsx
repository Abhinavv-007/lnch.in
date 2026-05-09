import { useEffect, useRef } from "react";

/**
 * Canvas-backed background particles with strong 3D motion.
 *
 * The previous version had subtle z-depth and a small parallax under the
 * cursor; the user wanted the field to read as actual 3D motion (clex-ai
 * style). This version layers three depth bands, gives each particle its
 * own ambient orbit, and applies an explicit parallax shift across the
 * whole field as the cursor moves — so foreground particles slide noticeably
 * faster than deep ones and the whole scene appears to rotate in z.
 *
 * Notes:
 *   - Density scales with viewport area; clamped to keep mobile cheap.
 *   - Pointer interaction is opt-out via `prefers-reduced-motion`.
 *   - Painted at devicePixelRatio (capped at 2) so the dots stay crisp.
 *   - Reads the gilt accent + soft from CSS custom properties so it
 *     retones in light mode without JS.
 */
export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

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
      220,
      Math.max(80, Math.round((width * height) / 14000)),
    );

    type P = {
      // Anchor coordinates the particle drifts around. The displayed
      // position on each frame is anchor + ambient orbit + parallax shift.
      ax: number;
      ay: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      // Ambient orbit: each particle traces a tiny ellipse so the field
      // breathes even when the cursor is still.
      orbitRx: number;
      orbitRy: number;
      orbitPhase: number;
      orbitSpeed: number;
      size: number;
      // 0..1; 0 = foreground, 1 = far background.
      depth: number;
      // Twinkle phase for alpha modulation.
      tw: number;
    };

    const particles: P[] = Array.from({ length: targetDensity }, () => {
      // Banded depth distribution: 35% near, 35% mid, 30% far. Gives the
      // foreground/background a clearer parallax separation than a uniform
      // distribution where most particles end up clustered in the middle.
      const r = Math.random();
      const depth = r < 0.35 ? r * 0.3 : r < 0.7 ? 0.3 + (r - 0.35) * 1.0 : 0.65 + (r - 0.7) * 1.16;
      const ax = Math.random() * width;
      const ay = Math.random() * height;
      const baseSpeed = 0.22 * (1 - depth * 0.55);
      return {
        ax,
        ay,
        x: ax,
        y: ay,
        vx: (Math.random() - 0.5) * baseSpeed,
        vy: (Math.random() - 0.5) * baseSpeed,
        orbitRx: 6 + Math.random() * 14 * (1 - depth * 0.4),
        orbitRy: 6 + Math.random() * 14 * (1 - depth * 0.4),
        orbitPhase: Math.random() * Math.PI * 2,
        orbitSpeed: 0.0035 + Math.random() * 0.0055 * (1 - depth * 0.5),
        size: 0.55 + Math.random() * 1.7 * (1 - depth * 0.65),
        depth,
        tw: Math.random() * Math.PI * 2,
      };
    });

    const mouse = {
      x: width / 2,
      y: height / 2,
      tx: width / 2,
      ty: height / 2,
      active: false,
    };
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
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
      const accentDeep = css.getPropertyValue("--gilt-deep").trim() || "#c8a955";
      return { accent, accentSoft, accentDeep };
    };
    let theme = readTheme();
    const themeObs = new MutationObserver(() => (theme = readTheme()));
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const FORCE_RADIUS = 200;
    const TWINKLE_SPEED = 0.05;
    // Maximum parallax displacement, in px, applied to the foremost layer.
    // Deep layers move proportionally less. Larger value = stronger 3D feel.
    const PARALLAX = 32;

    const tick = () => {
      // Smoothly chase the actual cursor position so the parallax doesn't
      // snap with each pointermove event — this is what reads as "the
      // whole scene rotating" rather than just dots jiggling.
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      const cx = width / 2;
      const cy = height / 2;
      const px = (mouse.x - cx) / cx; // -1..1
      const py = (mouse.y - cy) / cy;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Repulsion when the actual cursor is close. We use the smoothed
        // cursor here so the kicks feel weighted, not snappy.
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < FORCE_RADIUS * FORCE_RADIUS) {
            const dist = Math.sqrt(dist2) || 1;
            const force = (FORCE_RADIUS - dist) / FORCE_RADIUS;
            // Foreground reacts harder than deep, so the depth separation
            // reads in motion, not just in size/alpha.
            const reactivity = 0.6 * (1 - p.depth * 0.6);
            p.vx -= (dx / dist) * force * reactivity;
            p.vy -= (dy / dist) * force * reactivity;
          }
        }

        // Anchor drifts with the particle's velocity; ambient orbit and
        // parallax are then added on top so the cursor parallax doesn't
        // permanently displace particles off the canvas.
        p.ax += p.vx;
        p.ay += p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.orbitPhase += p.orbitSpeed;
        p.tw += TWINKLE_SPEED * (0.6 + p.depth);

        // Per-depth parallax offset — the 3D shift. Far particles barely
        // move; the foreground glides noticeably under the cursor.
        const layerStrength = (1 - p.depth) ** 1.3;
        const ox = -px * PARALLAX * layerStrength;
        const oy = -py * PARALLAX * layerStrength;

        const orbitX = Math.cos(p.orbitPhase) * p.orbitRx;
        const orbitY = Math.sin(p.orbitPhase) * p.orbitRy;

        p.x = p.ax + orbitX + ox;
        p.y = p.ay + orbitY + oy;

        // Wrap anchors so the field never depletes.
        if (p.ax > width + 6) p.ax = -6;
        else if (p.ax < -6) p.ax = width + 6;
        if (p.ay > height + 6) p.ay = -6;
        else if (p.ay < -6) p.ay = height + 6;

        const flicker = 0.6 + Math.sin(p.tw) * 0.35;
        const baseAlpha = 0.16 + (1 - p.depth) * 0.6;
        const alpha = Math.max(0.05, Math.min(0.95, baseAlpha * flicker));

        ctx.globalAlpha = alpha;
        // Three colour layers — soft, accent, deep — drawn from CSS
        // tokens. Foreground = soft (brightest), mid = accent, deep =
        // deep gilt. Increases the perceived z separation.
        ctx.fillStyle =
          p.depth < 0.33
            ? theme.accentSoft
            : p.depth < 0.66
              ? theme.accent
              : theme.accentDeep;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
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
