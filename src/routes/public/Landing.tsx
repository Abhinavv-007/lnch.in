/**
 * Public lnch.in launch hub.
 *
 * This is the only route end-users see. The previous deployment was a Vite
 * SPA with a similar dark/gilt aesthetic; the goal here is to preserve that
 * mood while introducing the projects we now operate.
 */
import { Link } from "react-router-dom";
import { ArrowUpRight, Lock } from "lucide-react";

const PROJECTS = [
  {
    name: "Modih Mail",
    site: "https://modih.in",
    blurb: "Cinematic disposable email. Cloudflare-edge native, developer API.",
    tone: "from-orange-500/10 to-orange-500/0",
  },
  {
    name: "Clex",
    site: "https://clex.in",
    blurb: "Privacy-first WebRTC file transfer with Workspace, Vault and Chain.",
    tone: "from-emerald-500/10 to-emerald-500/0",
  },
  {
    name: "Clex AI",
    site: "https://ai.clex.in",
    blurb: "Every AI model, one OpenAI-compatible API. 130+ models, one bill.",
    tone: "from-gilt-500/10 to-gilt-500/0",
  },
  {
    name: "Driped",
    site: "https://driped.in",
    blurb: "Subscription tracker that finds, parses and cancels recurring charges.",
    tone: "from-sky-500/10 to-sky-500/0",
  },
  {
    name: "TRGT",
    site: "https://trgt.in",
    blurb: "Visual F1-grade research and performance experiences.",
    tone: "from-rose-500/10 to-rose-500/0",
  },
  {
    name: "Portfolio",
    site: "https://abhnv.in",
    blurb: "Case studies, research papers and the projects behind the launches.",
    tone: "from-violet-500/10 to-violet-500/0",
  },
];

export default function LandingPage() {
  return (
    <main className="bg-stage min-h-screen">
      <Header />

      <section className="relative mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-36 md:pb-24">
        <div className="absolute inset-x-0 top-0 mx-auto h-px max-w-[80%] bg-gradient-to-r from-transparent via-gilt-500/30 to-transparent" />
        <p className="mb-5 text-xs uppercase tracking-[0.3em] text-gilt-300">
          where projects go live
        </p>
        <h1 className="heading-display text-5xl leading-[1.05] md:text-7xl lg:text-8xl">
          Ship the work.
          <br />
          <span className="italic text-gilt-300">Run the rest.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-200 md:text-lg">
          lnch.in is the public face — and the private command center — for the
          projects I build:
          <span className="text-ink-100"> Modih Mail, Clex, Clex AI, Driped, TRGT, Portfolio.</span>
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <a className="btn-primary" href="#projects">
            Browse projects
          </a>
          <Link to="/ops" className="btn-ghost">
            <Lock className="h-4 w-4" /> Operator console
          </Link>
        </div>
      </section>

      <section id="projects" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gilt-300">
              The launch slate
            </p>
            <h2 className="heading-display mt-2 text-3xl md:text-4xl">
              Projects in flight
            </h2>
          </div>
          <span className="hidden text-xs text-ink-300 md:inline">
            {PROJECTS.length} active
          </span>
        </div>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((p) => (
            <li key={p.name} className="group">
              <a
                href={p.site}
                target="_blank"
                rel="noreferrer"
                className="panel-glow flex h-full flex-col justify-between p-5 transition hover:border-gilt-700/60"
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${p.tone} opacity-0 transition group-hover:opacity-100`}
                />
                <div className="relative">
                  <p className="font-serif text-2xl tracking-tight text-ink-100">
                    {p.name}
                  </p>
                  <p className="mt-2 text-sm text-ink-200/90">{p.blurb}</p>
                </div>
                <div className="relative mt-6 flex items-center justify-between text-xs text-ink-300">
                  <span>{new URL(p.site).host}</span>
                  <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-600/40 bg-ink-950/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulseGlow rounded-full bg-gilt-300" />
          </span>
          <span className="tracking-[0.32em] text-sm font-medium">LNCH.IN</span>
        </Link>
        <nav className="hidden gap-8 text-sm text-ink-200 md:flex">
          <a href="#projects" className="hover:text-ink-100">Projects</a>
          <a href="https://github.com/Abhinavv-007" target="_blank" rel="noreferrer" className="hover:text-ink-100">GitHub</a>
          <Link to="/ops" className="hover:text-gilt-300">Operator</Link>
        </nav>
        <Link to="/ops" className="rounded-full border border-ink-500 bg-ink-800/70 px-4 py-1.5 text-xs font-medium text-ink-100 hover:border-gilt-500/60 hover:text-gilt-200">
          Sign in
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-600/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-xs text-ink-300 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} lnch.in · built on Cloudflare</p>
        <p className="font-mono">
          base_url = <span className="text-gilt-300">"https://lnch.in"</span>
        </p>
      </div>
    </footer>
  );
}
