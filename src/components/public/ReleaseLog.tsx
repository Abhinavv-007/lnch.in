import { Github } from "lucide-react";
import { RELEASES, type Release, type ReleaseTag } from "@/lib/versions";

/**
 * Public release log — every merged PR rendered as a poster-style card.
 *
 * Layout:
 *   - Two-column grid on md+ (≥ 768px), single column on phones.
 *   - Each card carries: version chip · date · headline · bullet list ·
 *     tags · "view PR" link.
 *   - The most recent release is marked with a "now serving" stamp so
 *     users can scan to current state instantly.
 *
 * Source of truth: `src/lib/versions.ts`. No network call — the list is
 * inlined into the bundle and tree-shaken alongside the route.
 */
const TAG_LABEL: Record<ReleaseTag, string> = {
  feature: "feature",
  polish: "polish",
  fix: "fix",
  infra: "infra",
};

const TAG_CLASS: Record<ReleaseTag, string> = {
  feature: "text-[color:var(--signal-ok)]",
  polish: "text-accent",
  fix: "text-[color:var(--signal-warn)]",
  infra: "text-fg-soft",
};

export default function ReleaseLog() {
  return (
    <ol className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {RELEASES.map((r, idx) => (
        <li key={r.version}>
          <ReleaseCard release={r} latest={idx === 0} />
        </li>
      ))}
    </ol>
  );
}

function ReleaseCard({ release, latest }: { release: Release; latest: boolean }) {
  return (
    <article className="poster-card poster-card--sm flex h-full flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.28em] text-accent">
            v{release.version}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            {release.date}
          </span>
        </div>
        {latest ? (
          <span className="poster-stamp">
            <span className="poster-bullet" /> now serving
          </span>
        ) : null}
      </header>

      <h3 className="font-serif text-lg leading-snug text-fg">
        {release.headline}
      </h3>

      <ul className="flex flex-1 flex-col gap-1.5 text-sm leading-relaxed text-fg-soft">
        {release.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span aria-hidden className="text-muted">·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap gap-2">
          {release.tags.map((t) => (
            <span
              key={t}
              className={`font-mono text-[10px] uppercase tracking-[0.22em] ${TAG_CLASS[t]}`}
            >
              · {TAG_LABEL[t]}
            </span>
          ))}
        </div>
        <a
          href={`https://github.com/Abhinavv-007/lnch.in/pull/${release.prNumber}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-fg-soft hover:text-accent"
        >
          <Github className="h-3 w-3" /> #{release.prNumber}
        </a>
      </footer>
    </article>
  );
}
