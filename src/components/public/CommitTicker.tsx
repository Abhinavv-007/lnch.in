import { Github } from "lucide-react";

type Commit = {
  project: string;
  repo: string;
  sha: string;
  message: string;
  author: string;
  ts: number;
};

function timeAgo(ts: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(ts * 1000).toLocaleDateString();
}

/**
 * Horizontal infinite-scroll commit ticker. Pauses on hover. The list is
 * duplicated so the keyframe `marquee` animation can loop seamlessly.
 */
export default function CommitTicker({ commits }: { commits: Commit[] | null }) {
  const items = commits ?? [];
  if (items.length === 0) {
    return (
      <div className="paper-panel-soft px-4 py-2 text-xs text-fg-soft">
        <span className="text-accent">git log</span> — fetching recent commits…
      </div>
    );
  }
  const doubled = [...items, ...items];
  return (
    <div className="paper-panel-soft overflow-hidden">
      <div className="animate-marquee flex gap-6 whitespace-nowrap py-3 pl-4 pr-8 text-xs">
        {doubled.map((c, i) => (
          <a
            key={`${c.sha}-${i}`}
            href={`https://github.com/${c.repo}/commit/${c.sha}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-fg-soft hover:text-fg"
          >
            <Github className="h-3 w-3 text-muted" />
            <span className="text-accent">{c.project}</span>
            <span className="font-mono text-muted">{c.sha}</span>
            <span className="max-w-[34ch] overflow-hidden text-ellipsis whitespace-nowrap">
              {c.message}
            </span>
            <span className="text-muted">· {c.author} · {timeAgo(c.ts)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export type { Commit };
