/**
 * Public `/developers` page.
 *
 * Renders a copy-paste reference for every public lnch.in endpoint. The
 * machine-readable index lives at `/api/public/developers`; this surface
 * is just the HTML render of that same data.
 *
 * Visual: matches the editorial poster system the rest of the public
 * surface uses — scalloped cards, dotted paper grid, mono eyebrows,
 * serif italic accents.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Activity, Terminal, Copy, Check, ShieldCheck } from "lucide-react";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";

type EndpointParam = {
  name: string;
  required?: boolean;
  description: string;
  example?: string;
  default?: string;
};

type Endpoint = {
  id: string;
  method: "GET";
  path: string;
  summary: string;
  description: string;
  perProject: boolean;
  category: "registry" | "project" | "activity" | "search" | "service";
  params?: EndpointParam[];
  exampleSlug?: string;
};

type DevelopersResponse = {
  generatedAt: number;
  origin: string;
  rateLimit: {
    defaultDailyLimit: number;
    windowSec: number;
    scope: "per-ip";
    excluded: string[];
    headers: string[];
    notes: string;
  };
  projects: { slug: string; name: string }[];
  endpoints: Endpoint[];
};

const CATEGORY_LABEL: Record<Endpoint["category"], string> = {
  registry: "registry",
  project: "per project",
  activity: "activity",
  search: "search",
  service: "service",
};

const CATEGORY_ORDER: Endpoint["category"][] = [
  "registry",
  "project",
  "activity",
  "search",
  "service",
];

function buildExampleUrl(origin: string, ep: Endpoint, slug: string, paramOverrides: Record<string, string>): string {
  const path = ep.path.replace(":slug", slug);
  const params = new URLSearchParams();
  for (const p of ep.params ?? []) {
    const v = paramOverrides[p.name] ?? p.default ?? p.example;
    if (v) params.set(p.name, v);
  }
  const qs = params.toString();
  return `${origin}${path}${qs ? "?" + qs : ""}`;
}

function curlSnippet(url: string): string {
  return `curl -s "${url}" | jq`;
}

function jsSnippet(url: string): string {
  return `const res = await fetch("${url}");\nconst body = await res.json();\nconsole.log(body);`;
}

function pythonSnippet(url: string): string {
  return `import requests\n\nbody = requests.get("${url}").json()\nprint(body)`;
}

export default function DevelopersPage() {
  const [data, setData] = useState<DevelopersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState<string>("modih");
  const [activeCategory, setActiveCategory] = useState<Endpoint["category"] | "all">("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/public/developers", { credentials: "omit" });
        if (!r.ok) {
          setError(`HTTP ${r.status}`);
          return;
        }
        const body = (await r.json()) as DevelopersResponse;
        if (!cancelled) {
          setData(body);
          if (body.projects[0]) setActiveSlug(body.projects[0].slug);
        }
      } catch {
        if (!cancelled) setError("Network error — couldn't reach /api/public/developers");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const origin = data?.origin ?? (typeof window !== "undefined" ? window.location.origin : "https://lnch.in");

  const grouped = useMemo(() => {
    if (!data) return new Map<Endpoint["category"], Endpoint[]>();
    const m = new Map<Endpoint["category"], Endpoint[]>();
    for (const ep of data.endpoints) {
      const arr = m.get(ep.category) ?? [];
      arr.push(ep);
      m.set(ep.category, arr);
    }
    return m;
  }, [data]);

  return (
    <main className="bg-paper-grid min-h-screen">
      <PublicHeader />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-10 md:pt-24 md:pb-14">
        <div className="poster-card poster-live">
          <div className="flex flex-wrap items-center gap-3 mb-7">
            <span className="poster-stamp">
              <Terminal className="h-3 w-3" />
              developers · vol. 01
            </span>
            <p className="poster-eyebrow text-fg-soft">copy. paste. ship.</p>
          </div>
          <h1 className="poster-headline">
            Public APIs.
            <span className="accent">No keys, no signups.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-fg-soft md:text-lg">
            Every signal the operator console sees, lnch.in publishes back out — JSON over HTTPS,
            cacheable, rate-limited but never gated. Hit them from CI, dashboards, or your terminal.
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            <RateLimitChip label="daily budget" value={data?.rateLimit.defaultDailyLimit} suffix="req · per IP" />
            <RateLimitChip label="window" value={data ? data.rateLimit.windowSec / 3600 : null} suffix="hours · UTC reset" />
            <RateLimitChip label="auth" value={"none"} suffix="public · open" />
          </div>

          <div className="poster-footer-strip mt-10">
            <span className="poster-footer-strip__brand">
              <span className="poster-bullet" />
              LNCH.IN
            </span>
            <span>edition · public</span>
            <span>{origin.replace(/^https?:\/\//, "")}</span>
          </div>
        </div>
      </section>

      {/* Quickstart card */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="poster-card poster-card--sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="poster-eyebrow">quickstart</p>
              <h2 className="poster-headline poster-headline--md mt-2">
                List every <span className="accent">project</span> right now
              </h2>
            </div>
            <a
              href={`${origin}/api/public/projects`}
              target="_blank"
              rel="noreferrer"
              className="poster-stamp"
            >
              try in browser
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <CodeBlock label="curl" code={curlSnippet(`${origin}/api/public/projects`)} />
            <CodeBlock label="fetch (js)" code={jsSnippet(`${origin}/api/public/projects`)} />
            <CodeBlock label="requests (py)" code={pythonSnippet(`${origin}/api/public/projects`)} />
          </div>
        </div>
      </section>

      {error && !data && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="poster-card poster-card--sm">
            <p className="poster-eyebrow">offline</p>
            <p className="mt-2 text-sm text-fg-soft">{error}. The endpoint list is hardcoded; try refreshing.</p>
          </div>
        </section>
      )}

      {data && (
        <>
          {/* Per-project switcher (only relevant for the project endpoints) */}
          <section className="mx-auto max-w-6xl px-6 pb-6">
            <div className="poster-card poster-card--sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="poster-eyebrow">try against</p>
                  <h3 className="poster-headline poster-headline--sm mt-2">
                    Pick a <span className="accent">project</span>
                  </h3>
                </div>
                <p className="hidden text-xs uppercase tracking-[0.28em] text-muted md:block">
                  swaps `:slug` in every per-project example
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {data.projects.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => setActiveSlug(p.slug)}
                    className={
                      p.slug === activeSlug
                        ? "poster-stamp poster-stamp--filled text-fg"
                        : "poster-stamp"
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Category filter */}
          <section className="mx-auto max-w-6xl px-6 pb-8">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="poster-eyebrow text-muted">filter</span>
              <button
                onClick={() => setActiveCategory("all")}
                className={
                  activeCategory === "all"
                    ? "poster-stamp poster-stamp--filled text-fg"
                    : "poster-stamp"
                }
              >
                all ({data.endpoints.length})
              </button>
              {CATEGORY_ORDER.map((c) => {
                const count = grouped.get(c)?.length ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={
                      activeCategory === c
                        ? "poster-stamp poster-stamp--filled text-fg"
                        : "poster-stamp"
                    }
                  >
                    {CATEGORY_LABEL[c]} ({count})
                  </button>
                );
              })}
            </div>
          </section>

          {/* Endpoints */}
          <section className="mx-auto max-w-6xl px-6 pb-16">
            <ul className="grid grid-cols-1 gap-4">
              {data.endpoints
                .filter((ep) => activeCategory === "all" || ep.category === activeCategory)
                .map((ep) => (
                  <EndpointCard
                    key={ep.id}
                    endpoint={ep}
                    origin={origin}
                    activeSlug={ep.exampleSlug ?? activeSlug}
                  />
                ))}
            </ul>
          </section>

          {/* Rate limit policy */}
          <section className="mx-auto max-w-6xl px-6 pb-16">
            <div className="poster-card poster-card--sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <p className="poster-eyebrow">rate limits</p>
              </div>
              <h3 className="poster-headline poster-headline--sm mt-3">
                <span className="accent">{data.rateLimit.defaultDailyLimit}</span> requests · per IP · per UTC day
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-soft">
                {data.rateLimit.notes}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="poster-eyebrow text-muted">response headers</p>
                  <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                    {data.rateLimit.headers.map((h) => (
                      <li key={h}>
                        <code className="poster-stamp">{h}</code>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="poster-eyebrow text-muted">excluded from budget</p>
                  <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                    {data.rateLimit.excluded.map((p) => (
                      <li key={p}>
                        <code className="poster-stamp">{p}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="poster-card poster-card--sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-soft">
              Operator console for these surfaces lives at{" "}
              <Link to="/ops" className="text-accent hover:underline">
                /ops
              </Link>
              .
            </p>
            <Link to="/" className="poster-button">
              <Activity className="h-3.5 w-3.5" /> back to lnch.in
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function RateLimitChip({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string | null | undefined;
  suffix: string;
}) {
  return (
    <div className="poster-stat poster-stat--block">
      <p className="poster-stat__label">{label}</p>
      <p className="poster-stat__value">
        {value == null ? <span className="text-muted">—</span> : value}
      </p>
      <p className="poster-stat__hint">{suffix}</p>
    </div>
  );
}

function EndpointCard({
  endpoint,
  origin,
  activeSlug,
}: {
  endpoint: Endpoint;
  origin: string;
  activeSlug: string;
}) {
  const [activeLang, setActiveLang] = useState<"shell" | "js" | "python">("shell");
  const [paramOverrides] = useState<Record<string, string>>({});
  const url = buildExampleUrl(origin, endpoint, activeSlug, paramOverrides);

  const code =
    activeLang === "shell"
      ? curlSnippet(url)
      : activeLang === "js"
        ? jsSnippet(url)
        : pythonSnippet(url);

  return (
    <li className="poster-card poster-card--sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="poster-stamp poster-stamp--filled text-fg">{endpoint.method}</span>
            <code className="font-mono text-sm text-fg break-all">{endpoint.path}</code>
            <span className="poster-stamp">{CATEGORY_LABEL[endpoint.category]}</span>
          </div>
          <h3 className="poster-headline poster-headline--sm mt-3">
            <span className="accent">{endpoint.summary}</span>
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-soft">{endpoint.description}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="poster-stamp shrink-0"
          aria-label="Open in a new tab"
        >
          try in browser
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>

      {endpoint.params && endpoint.params.length > 0 && (
        <div className="mt-5">
          <p className="poster-eyebrow text-muted">params</p>
          <ul className="mt-2 grid gap-1.5 text-xs">
            {endpoint.params.map((p) => (
              <li key={p.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <code className="font-mono text-fg">{p.name}</code>
                {p.required && <span className="text-accent">required</span>}
                <span className="text-fg-soft">{p.description}</span>
                {p.default && <span className="text-muted">default: {p.default}</span>}
                {p.example && !p.default && <span className="text-muted">e.g. {p.example}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 text-xs">
            <button
              onClick={() => setActiveLang("shell")}
              className={
                activeLang === "shell" ? "poster-stamp poster-stamp--filled text-fg" : "poster-stamp"
              }
            >
              curl
            </button>
            <button
              onClick={() => setActiveLang("js")}
              className={
                activeLang === "js" ? "poster-stamp poster-stamp--filled text-fg" : "poster-stamp"
              }
            >
              fetch
            </button>
            <button
              onClick={() => setActiveLang("python")}
              className={
                activeLang === "python" ? "poster-stamp poster-stamp--filled text-fg" : "poster-stamp"
              }
            >
              requests
            </button>
          </div>
          <CopyButton code={code} />
        </div>
        <pre className="terminal overflow-x-auto rounded-xl px-5 py-4 text-sm">
          <code className="block whitespace-pre">{code}</code>
        </pre>
      </div>
    </li>
  );
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        if (typeof navigator === "undefined" || !navigator.clipboard) return;
        navigator.clipboard.writeText(code).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          },
          () => {
            /* clipboard denied — silently fail */
          },
        );
      }}
      className="poster-stamp"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" /> copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" /> copy
        </>
      )}
    </button>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="rounded-xl border border-rule bg-paper-elev p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="poster-eyebrow text-muted">{label}</span>
        <CopyButton code={code} />
      </div>
      <pre className="terminal overflow-x-auto rounded-md px-3 py-2 text-xs">
        <code className="block whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}
