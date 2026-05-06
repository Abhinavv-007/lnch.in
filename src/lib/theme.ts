/**
 * Theme management for the public surface.
 *
 * The `<html>` element gets either `data-theme="light"` (paper / cream UI) or
 * no attribute (dark default). We do NOT touch Tailwind's `dark` class — that
 * still lives on `<html>` so the legacy /ops palette keeps rendering. The
 * inline script in `index.html` sets the initial value before first paint to
 * avoid a flash.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "lnch-theme";

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
