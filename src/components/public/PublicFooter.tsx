import { Github, Linkedin, Mail, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Public footer.
 *
 * Three lanes on md+:
 *   1) tagline    — © year · /version link
 *   2) curl tease — short example of the public registry endpoint
 *   3) socials    — /developers · LinkedIn · GitHub · email
 *
 * On mobile the lanes stack and the socials row wraps so every link stays
 * tappable without horizontal scroll.
 */
export default function PublicFooter() {
  return (
    <footer className="border-t border-rule bg-paper-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-xs text-fg-soft md:flex-row md:items-center md:justify-between">
        <p>
          © {new Date().getFullYear()} lnch.in ·{" "}
          <Link to="/#versions" className="hover:text-accent">
            release log
          </Link>
        </p>
        <p className="font-mono break-all">
          <span className="text-accent">$</span> curl -s https://lnch.in/api/public/projects
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            to="/developers"
            className="inline-flex items-center gap-1 hover:text-accent"
          >
            <Terminal className="h-3 w-3" /> /developers
          </Link>
          <a
            href="https://www.linkedin.com/in/abhnv07/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-accent"
            aria-label="LinkedIn — abhnv07"
          >
            <Linkedin className="h-3 w-3" /> linkedin.com/in/abhnv07
          </a>
          <a
            href="https://github.com/Abhinavv-007"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-accent"
          >
            <Github className="h-3 w-3" /> github.com/Abhinavv-007
          </a>
          <a
            href="mailto:abhnv@abhnv.in"
            className="inline-flex items-center gap-1 hover:text-accent"
            aria-label="Email — abhnv@abhnv.in"
          >
            <Mail className="h-3 w-3" /> abhnv@abhnv.in
          </a>
        </div>
      </div>
    </footer>
  );
}
