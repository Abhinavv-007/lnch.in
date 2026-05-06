export function timeAgo(ts: number | string | null | undefined): string {
  if (ts == null) return "—";
  const t = typeof ts === "string" ? Date.parse(ts) : ts;
  if (!Number.isFinite(t)) return "—";
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return `${Math.max(0, Math.floor(diff))}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))}w ago`;
  return new Date(t).toLocaleDateString();
}

export function compactNumber(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function shortHash(sha: string | undefined | null, n = 7): string {
  if (!sha) return "—";
  return sha.slice(0, n);
}
