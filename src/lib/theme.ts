/**
 * Theme management for the public surface.
 *
 * The `<html>` element gets either `data-theme="light"` (paper / cream UI) or
 * no attribute (dark default). We do NOT touch Tailwind's `dark` class — that
 * still lives on `<html>` so the legacy /ops palette keeps rendering. The
 * inline script in `index.html` sets the initial value before first paint to
 * avoid a flash.
 *
 * The toggle uses the View Transitions API to animate a circular reveal of
 * the new theme expanding from the click origin (or the toggle button on
 * keyboard). On browsers without View Transitions we use a clip-path
 * overlay that paints the *outgoing* theme on top, then animates a
 * shrinking circle so the new theme bleeds in from the origin point.
 *
 * Honors `prefers-reduced-motion: reduce` — the swap happens instantly.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "lnch-theme";
const REVEAL_DURATION_MS = 720;
const REVEAL_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    ready: Promise<void>;
    finished: Promise<void>;
    skipTransition?: () => void;
  };
};

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
  } else {
    root.removeAttribute("data-theme");
    root.classList.add("dark");
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* localStorage may be unavailable (private mode, embedded contexts) */
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pointFromEvent(e?: MouseEvent | { clientX: number; clientY: number } | null): {
  x: number;
  y: number;
} {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  if (e && typeof e.clientX === "number" && typeof e.clientY === "number") {
    return { x: e.clientX, y: e.clientY };
  }
  return { x: window.innerWidth, y: 0 };
}

function farthestCornerRadius(x: number, y: number): number {
  if (typeof window === "undefined") return 0;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dx = Math.max(x, w - x);
  const dy = Math.max(y, h - y);
  return Math.hypot(dx, dy);
}

function readBackground(): string {
  if (typeof window === "undefined") return "#000";
  const cs = window.getComputedStyle(document.documentElement);
  return cs.getPropertyValue("--bg").trim() || "#000";
}

/**
 * Apply a theme with a circular reveal animation originating from the given
 * click coordinates. Falls back to instant swap if reveal isn't available.
 */
export function applyThemeWithReveal(
  next: Theme,
  origin?: MouseEvent | { clientX: number; clientY: number } | null,
) {
  if (typeof document === "undefined") {
    applyTheme(next);
    return;
  }
  if (prefersReducedMotion()) {
    applyTheme(next);
    return;
  }
  const { x, y } = pointFromEvent(origin);
  const radius = farthestCornerRadius(x, y);

  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition === "function") {
    runViewTransitionReveal(doc, next, x, y, radius);
    return;
  }
  runOverlayReveal(next, x, y, radius);
}

function runViewTransitionReveal(
  doc: ViewTransitionDocument,
  next: Theme,
  x: number,
  y: number,
  radius: number,
) {
  const start = doc.startViewTransition?.(() => applyTheme(next));
  if (!start) {
    applyTheme(next);
    return;
  }
  start.ready
    .then(() => {
      doc.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: REVEAL_DURATION_MS,
          easing: REVEAL_EASING,
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      // If the animation hook fails, the swap has already happened.
    });
}

function runOverlayReveal(next: Theme, x: number, y: number, radius: number) {
  const outgoingBg = readBackground();
  applyTheme(next);
  const overlay = document.createElement("div");
  overlay.setAttribute("data-theme-reveal", "");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    `background:${outgoingBg}`,
    "z-index:2147483646",
    "pointer-events:none",
    `clip-path:circle(${radius}px at ${x}px ${y}px)`,
    `transition:clip-path ${REVEAL_DURATION_MS}ms ${REVEAL_EASING}`,
    "will-change:clip-path",
  ].join(";");
  document.body.appendChild(overlay);
  // Force a frame so the transition applies.
  requestAnimationFrame(() => {
    overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  });
  window.setTimeout(() => {
    overlay.remove();
  }, REVEAL_DURATION_MS + 50);
}

/**
 * Force the `/ops` console to always render in dark mode. The legacy ops
 * palette is dark-only; a light-mode preference saved on the public surface
 * shouldn't bleed into the operator UI.
 */
export function pinThemeForOps(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  const prevAttr = root.getAttribute("data-theme");
  const prevHasDark = root.classList.contains("dark");
  root.removeAttribute("data-theme");
  root.classList.add("dark");
  return () => {
    if (prevAttr) root.setAttribute("data-theme", prevAttr);
    if (!prevHasDark) root.classList.remove("dark");
  };
}
