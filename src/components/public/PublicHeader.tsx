import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

/**
 * Header for the public surface. Uses the paper/fg/rule CSS-variable
 * utilities so it flips cleanly in light mode.
 */
export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulseGlow rounded-full bg-accent" />
          </span>
          <span className="text-sm font-medium tracking-[0.32em] text-fg">LNCH.IN</span>
        </Link>
        <nav className="hidden gap-7 text-sm text-fg-soft md:flex">
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/ops"
            className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper-elev px-3.5 py-1.5 text-xs font-medium text-fg transition hover:border-accent hover:text-accent"
            aria-label="Sign in to the operator console"
          >
            <Lock className="h-3 w-3" />
            Operator sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
