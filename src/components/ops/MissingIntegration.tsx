import { AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Honest empty-state for when a backend integration isn't configured (no
 * token, no admin endpoint shipped yet, etc). Never fabricates data.
 */
export default function MissingIntegration({
  title,
  reason,
  hint,
  needs,
  to = "/ops/settings",
}: {
  title: string;
  reason: string;
  hint?: string;
  needs?: string[];
  to?: string;
}) {
  return (
    <div className="panel relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_180px_at_-10%_-20%,rgba(245,158,11,0.10),transparent_60%)]" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertCircle className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.28em]">Missing integration</p>
          </div>
          <h3 className="heading-display mt-2 text-2xl text-ink-100">{title}</h3>
          <p className="mt-2 text-sm text-ink-200">{reason}</p>
          {hint ? <p className="mt-2 text-xs text-ink-300">{hint}</p> : null}
          {needs && needs.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {needs.map((n) => (
                <li
                  key={n}
                  className="rounded-full border border-amber-700/40 bg-amber-900/20 px-2 py-0.5 font-mono text-[11px] text-amber-200"
                >
                  {n}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <Link to={to} className="btn-ghost shrink-0">
          Configure <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
