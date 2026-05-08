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
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:gap-6 md:px-6 md:py-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulseGlow rounded-full bg-accent" />
          </span>
          <span className="text-sm font-medium tracking-[0.32em] text-fg">LNCH.IN</span>
        </Link>

        <div className="min-w-0 flex-1">
          <PublicSearch />
        </div>

        <nav className="hidden gap-5 text-sm text-fg-soft lg:flex">
          <Link to="/#projects" className="hover:text-fg">Projects</Link>
          <Link to="/#status" className="hover:text-fg">Status</Link>
          <Link to="/#api" className="hover:text-fg">API</Link>
          <a
            href="https://github.com/Abhinavv-007"
            target="_blank"
            rel="noreferrer"
            className="hover:text-fg"
          >
            GitHub
          </a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
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
    </header>
  );
}
