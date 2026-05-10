import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import PublicSearch from "./PublicSearch";

/**
 * Header for the public surface. Uses the paper/fg/rule CSS-variable
 * utilities so it flips cleanly in light mode.
 *
 * Layout:
 *   - left:   brand
 *   - middle: cross-project search (`PublicSearch`)
 *   - right:  theme toggle + nav + operator sign-in
 *
 * Search lives in the middle so it's reachable from every public surface
 * without the user having to scroll back to the landing page.
 */
export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 md:px-6 md:py-4">
        {/* Top row: brand + (desktop) inline search + nav + theme/sign-in.
            On mobile we drop the search out of this row so the brand,
            theme toggle, and sign-in CTA never get clipped against each
            other on a 375-wide viewport. The search lives on its own row
            beneath the bar (still in the sticky header so it follows the
            user as they scroll). */}
        <div className="flex items-center gap-3 md:gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulseGlow rounded-full bg-accent" />
            </span>
            <span className="text-sm font-medium tracking-[0.32em] text-fg">LNCH.IN</span>
          </Link>

          <div className="hidden min-w-0 flex-1 md:block">
            <PublicSearch />
          </div>

          <nav className="hidden gap-5 text-sm text-fg-soft lg:flex">
            <Link to="/#projects" className="hover:text-fg">Projects</Link>
            <Link to="/#status" className="hover:text-fg">Status</Link>
            <Link to="/developers" className="hover:text-fg">Developers</Link>
            <a
              href="https://github.com/Abhinavv-007"
              target="_blank"
              rel="noreferrer"
              className="hover:text-fg"
            >
              GitHub
            </a>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            <ThemeToggle />
            <Link
              to="/ops"
              className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper-elev px-3 py-1.5 text-xs font-medium text-fg transition hover:border-accent hover:text-accent md:px-3.5"
              aria-label="Sign in to the operator console"
            >
              <Lock className="h-3 w-3" />
              <span className="hidden md:inline">Operator sign in</span>
              <span className="md:hidden">Sign in</span>
            </Link>
          </div>
        </div>

        {/* Mobile-only second row: full-width search. Hidden on md+ where
            the search sits inline in the top row. */}
        <div className="mt-3 md:hidden">
          <PublicSearch />
        </div>
      </div>
    </header>
  );
}
