import { Github } from "lucide-react";

export default function PublicFooter() {
  return (
    <footer className="border-t border-rule bg-paper-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-xs text-fg-soft md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} lnch.in · built on Cloudflare · everything is open source</p>
        <p className="font-mono">
          <span className="text-accent">$</span> curl -s https://lnch.in/api/public/projects
        </p>
        <a
          href="https://github.com/Abhinavv-007"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-accent"
        >
          <Github className="h-3 w-3" /> github.com/Abhinavv-007
        </a>
      </div>
    </footer>
  );
}
