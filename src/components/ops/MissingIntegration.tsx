import { AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Honest empty-state for when a backend integration isn't configured (no
 * token, no admin endpoint shipped yet, etc). Never fabricates data.
 *
 * Rendered as a poster card so it sits in the same visual system as the rest
 * of the dashboard rather than an out-of-place SaaS empty state.
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
    <div className="poster-card relative overflow-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[var(--signal-warn)]">
            <AlertCircle className="h-4 w-4" />
            <p className="poster-eyebrow">Missing integration</p>
          </div>
          <h3 className="poster-headline poster-headline--sm mt-2">{title}</h3>
          <p className="mt-2 text-sm text-fg-soft">{reason}</p>
          {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
          {needs && needs.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {needs.map((n) => (
                <li key={n} className="poster-stamp poster-stamp--warn">
                  {n}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <Link to={to} className="poster-button poster-button--primary shrink-0">
          Configure <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
