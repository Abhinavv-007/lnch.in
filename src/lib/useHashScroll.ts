import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to the element matching `location.hash` after the route renders.
 * React Router's `<Link to="/#status">` doesn't natively trigger anchor
 * scroll, so this hook fills the gap — it waits one tick for content to
 * mount, then scrolls smoothly to the element.
 *
 * Mount once at the top of any route component that contains anchor IDs.
 */
export function useHashScroll() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [hash, pathname]);
}
