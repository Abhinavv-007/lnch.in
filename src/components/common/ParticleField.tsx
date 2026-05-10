import { useEffect, useRef } from "react";

/**
 * Canvas-backed background particles.
 *
 * Goals:
 *   - Read as deliberate 3D motion: deep particles glide slowly, foreground
 *     ones swim noticeably faster under cursor parallax.
 *   - Stay visible in BOTH light and dark mode. Previous version used
 *     `mix-blend-mode: plus-lighter` which is invisible on the cream
 *     `#f8f1d9` paper background — light + light = white. We now set the
 *     blend mode and a per-mode alpha boost from CSS custom properties so
 *     the canvas retones with the rest of the theme.
 *   - Each particle has its own ambient orbit + a slow Bezier drift toward
 *     a fresh target every 4–6 s, so the field breathes when the cursor
 *     is still.
 *   - Foreground particles flash a soft gilt halo for ~600ms as the
 *     smoothed cursor passes through them — subtle, never a backdrop bloom.
 *
 * Notes:
 *   - Density scales with viewport area; clamped to keep mobile cheap.
 *   - Pointer interaction is opt-out via `prefers-reduced-motion`.
 *   - Painted at devicePixelRatio (capped at 2) so the dots stay crisp.
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
    // small screens or 4K displays. Mobile gets a slightly thinner field
    // so the dots aren't claustrophobic in a 375-wide canvas.
    const isMobile = width < 700;
    const targetDensity = isMobile
      ? Math.max(60, Math.round((width * height) / 16000))
      : Math.min(220, Math.max(90, Math.round((width * height) / 13000)));

    type P = {
      // Anchor coordinates the particle drifts toward; we lerp ax→tax.
      ax: number;
      ay: number;
      tax: number;
      tay: number;
      x: number;
      y: number;
      // Time (ms epoch) at which to pick a new drift target.
      tNext: number;
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
      // Halo flash intensity (0..1), set when cursor passes nearby.
      halo: number;
    };

    const pickTarget = (depth: number, x: number, y: number) => {
      // Drift radius shrinks with depth so background particles stay calm
      // and foreground ones roam more.
      const r = 60 + (1 - depth) * 90;
      const a = Math.random() * Math.PI * 2;
      return {
        tax: Math.max(-20, Math.min(width + 20, x + Math.cos(a) * r)),
        tay: Math.max(-20, Math.min(height + 20, y + Math.sin(a) * r)),
      };
    };

    const particles: P[] = Array.from({ length: targetDensity }, () => {
      // Banded depth distribution: 35% near, 35% mid, 30% far. Gives the
      // foreground/background a clearer parallax separation than a uniform
      // distribution where most particles end up clustered in the middle.
      const r = Math.random();
      const depth =
        r < 0.35
          ? r * 0.3
          : r < 0.7
            ? 0.3 + (r - 0.35) * 1.0
            : 0.65 + (r - 0.7) * 1.16;
      const ax = Math.random() * width;
      const ay = Math.random() * height;
      const t = pickTarget(depth, ax, ay);
      return {
        ax,
        ay,
        tax: t.tax,
        tay: t.tay,
        x: ax,
        y: ay,
        tNext: performance.now() + 2000 + Math.random() * 4000,
        orbitRx: 7 + Math.random() * 16 * (1 - depth * 0.4),
        orbitRy: 7 + Math.random() * 16 * (1 - depth * 0.4),
        orbitPhase: Math.random() * Math.PI * 2,
        orbitSpeed: 0.0035 + Math.random() * 0.0055 * (1 - depth * 0.5),
        size: 0.6 + Math.random() * 1.9 * (1 - depth * 0.6),
        depth,
        tw: Math.random() * Math.PI * 2,
        halo: 0,
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

    // Read theme tokens from CSS so we follow light/dark mode. The canvas
    // also reads its own blend-mode + alpha boost out of these tokens, so
    // light mode can switch to a darken-style blend that actually shows
    // up against cream paper.
    const readTheme = () => {
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue("--gilt").trim() || "#d9c57f";
      const accentSoft = css.getPropertyValue("--gilt-soft").trim() || "#e6d9a4";
      const accentDeep = css.getPropertyValue("--gilt-deep").trim() || "#c8a955";
      const blend =
        css.getPropertyValue("--particle-blend-mode").trim() || "screen";
      const boost =
        Number(css.getPropertyValue("--particle-alpha-boost")) || 1;
      const haloAlpha =
        Number(css.getPropertyValue("--particle-halo-alpha")) || 0.18;
      return { accent, accentSoft, accentDeep, blend, boost, haloAlpha };
    };
    let theme = readTheme();
    const applyBlend = () => {
      canvas.style.mixBlendMode = theme.blend;
    };
    applyBlend();
    const themeObs = new MutationObserver(() => {
      theme = readTheme();
      applyBlend();
    });
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const FORCE_RADIUS = 200;
    const HALO_RADIUS = 90;
    const TWINKLE_SPEED = 0.05;
    // Maximum parallax displacement, in px, applied to the foremost layer.
    // Deep layers move proportionally less. Larger = stronger 3D feel.
    const PARALLAX = 38;

    const tick = () => {
      const now = performance.now();
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

        // Pick a fresh drift target on a slow timer (4–6 s).
        if (now >= p.tNext) {
          const t = pickTarget(p.depth, p.ax, p.ay);
          p.tax = t.tax;
          p.tay = t.tay;
          p.tNext = now + 4000 + Math.random() * 2400;
        }
        // Lerp anchor toward target (depth dampens).
        const lerpK = 0.0018 + (1 - p.depth) * 0.0028;
        p.ax += (p.tax - p.ax) * lerpK;
        p.ay += (p.tay - p.ay) * lerpK;

        // Halo: charge when smoothed cursor is close, decay otherwise.
        if (mouse.active) {
          const dxh = mouse.x - p.x;
          const dyh = mouse.y - p.y;
          const distH = Math.sqrt(dxh * dxh + dyh * dyh);
          if (distH < HALO_RADIUS) {
            const charge = 1 - distH / HALO_RADIUS;
            // Foreground particles charge harder.
            const reactivity = 0.55 + (1 - p.depth) * 0.5;
            p.halo = Math.min(1, p.halo + charge * reactivity * 0.18);
          }
        }
        p.halo *= 0.93;

        // Soft repulsion when the actual cursor is very close — keeps the
        // “the field reacts to me” feel without a backdrop bloom.
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < FORCE_RADIUS * FORCE_RADIUS) {
            const dist = Math.sqrt(dist2) || 1;
            const force = (FORCE_RADIUS - dist) / FORCE_RADIUS;
            const reactivity = 0.5 * (1 - p.depth * 0.6);
            p.ax -= (dx / dist) * force * reactivity;
            p.ay -= (dy / dist) * force * reactivity;
          }
        }

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

        const flicker = 0.62 + Math.sin(p.tw) * 0.34;
        const baseAlpha = (0.18 + (1 - p.depth) * 0.6) * theme.boost;
        const alpha = Math.max(0.05, Math.min(0.98, baseAlpha * flicker));

        // Three colour layers — soft, accent, deep. Foreground = soft
        // (brightest), mid = accent, deep = deep gilt.
        const fill =
          p.depth < 0.33
            ? theme.accentSoft
            : p.depth < 0.66
              ? theme.accent
              : theme.accentDeep;

        // Halo flash — soft gilt glow that fades. Drawn first so the dot
        // sits on top of it.
        if (p.halo > 0.04) {
          const haloR = p.size * (3.2 + p.halo * 4.5);
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
          grad.addColorStop(0, theme.accentSoft);
          grad.addColorStop(1, "transparent");
          ctx.globalAlpha = Math.min(0.9, p.halo * theme.haloAlpha * 4);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
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
    />
  );
}
