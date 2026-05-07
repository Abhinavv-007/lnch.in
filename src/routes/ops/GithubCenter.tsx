import { useEffect, useState } from "react";
import { Github } from "lucide-react";
import PageHeader from "@/components/ops/PageHeader";
import StatCard from "@/components/ops/StatCard";
import SectionTitle from "@/components/ops/SectionTitle";
import MissingIntegration from "@/components/ops/MissingIntegration";
import { api } from "@/lib/api";
import { shortHash, timeAgo } from "@/lib/format";

type Bundle = {
  configured: boolean;
  totals: { commits: number; openPRs: number; openIssues: number; failingWorkflows: number };
  recentCommits: { repo: string; sha: string; message: string; author: string; ts: number }[];
  failingWorkflows: { repo: string; name: string; conclusion: string; ts: number }[];
  recentReleases: { repo: string; name: string; tag: string; ts: number }[];
  openPRs: { repo: string; number: number; title: string; ts: number; author: string }[];
};

export default function GithubCenter() {
  const [data, setData] = useState<Bundle | null>(null);
  useEffect(() => {
    api.get<Bundle>("/api/ops/github").then(setData).catch(() => setData(null));
  }, []);
  if (data && !data.configured) {
    return (
      <MissingIntegration
        title="GitHub not connected"
        reason="Set GITHUB_TOKEN in your Cloudflare Pages environment to surface activity across all repos."
        needs={["GITHUB_TOKEN"]}
      />
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="github center" title="GitHub" description="Live activity from across your repos." />
      <section className="poster-stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Github className="h-3.5 w-3.5" />} label="Recent commits" value={data?.totals.commits ?? "…"} tone="gilt" />
        <StatCard label="Open PRs" value={data?.totals.openPRs ?? "…"} tone="info" />
        <StatCard label="Open issues" value={data?.totals.openIssues ?? "…"} tone="neutral" />
        <StatCard label="Failing workflows" value={data?.totals.failingWorkflows ?? "…"} tone={data?.totals.failingWorkflows ? "err" : "ok"} />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle>Latest commits</SectionTitle>
          <ul className="divide-rule">
            {(data?.recentCommits ?? []).map((c) => (
              <li key={`${c.repo}-${c.sha}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2 text-sm">
                <span className="font-mono text-xs text-accent">{shortHash(c.sha)}</span>
                <div className="min-w-0">
                  <p className="truncate">{c.message}</p>
                  <p className="text-xs text-muted">{c.repo}</p>
                </div>
                <span className="text-xs text-muted">{timeAgo(c.ts)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <SectionTitle>Open PRs</SectionTitle>
          <ul className="divide-rule">
            {(data?.openPRs ?? []).map((p) => (
              <li key={`${p.repo}-${p.number}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate">
                  <span className="text-fg-soft">#{p.number}</span> {p.title}
                </span>
                <span className="text-xs text-muted">{p.repo} · {timeAgo(p.ts)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <SectionTitle>Failing workflows</SectionTitle>
          <ul className="divide-rule">
            {(data?.failingWorkflows ?? []).length === 0 ? (
              <li className="py-2 text-sm text-fg-soft">No failing workflows.</li>
            ) : (
              data!.failingWorkflows.map((w, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate">{w.name}</span>
                  <span className="pill-err">{w.conclusion}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="panel p-5">
          <SectionTitle>Releases</SectionTitle>
          <ul className="divide-rule">
            {(data?.recentReleases ?? []).length === 0 ? (
              <li className="py-2 text-sm text-fg-soft">No releases.</li>
            ) : (
              data!.recentReleases.map((r) => (
                <li key={`${r.repo}-${r.tag}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate">{r.name}</span>
                  <span className="text-xs text-muted">{r.tag} · {timeAgo(r.ts)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
