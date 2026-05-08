type LatencyPoint = { ts: number; latencyMs: number | null; ok: boolean };

/**
 * Recent-latency sparkline shown in the public landing's "latency · 24h"
 * poster. Renders three layers:
 *
 *   1. real probe samples — one filled dot per probe, sized by ok / fail
 *   2. smoothed trend line — Catmull-Rom-ish spline over the ok samples
 *      so a single 3000ms outlier doesn't tear the path into a saw-tooth
 *   3. red ticks at the bottom row when the probe failed
 *
 * Failed probes don't break the spline; the smoothed line uses only the
 * successful samples and the failures appear as red ticks underneath, so
 * the trend remains readable even on bad days.
 */
export default function LatencyStrip({
  points,
  maxLatency,
  height = 44,
}: {
  points: LatencyPoint[];
  maxLatency?: number;
  height?: number;
}) {
  if (!points || points.length === 0) {
    return <div className="text-xs text-muted">no probes yet</div>;
  }

  // Chronological ASC so the line reads left → right with time.
  const ordered = [...points].sort((a, b) => a.ts - b.ts);
  const w = Math.max(ordered.length, 24) * 8;
  const h = height;

  const okSamples = ordered
    .map((p, i) =>
      typeof p.latencyMs === "number" && p.ok
        ? { i, latency: p.latencyMs }
        : null,
    )
    .filter((v): v is { i: number; latency: number } => v !== null);

  // Cap ceiling so a single 3500ms outlier doesn't squash everything else
  // to a flat line at the bottom of the strip. Use a multiple of the
  // median rather than the max.
  const observed = ordered
    .map((p) => (typeof p.latencyMs === "number" ? p.latencyMs : 0))
    .filter((n) => n > 0);
  const sorted = observed.slice().sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 100;
  const dynamicCeiling = Math.max(median * 6, 120);
  const ceiling = maxLatency ?? Math.min(dynamicCeiling, 2_500);

  const xOf = (idx: number) => idx * 8 + 4;
  const yOf = (lat: number) =>
    Math.max(3, h - 6 - (Math.min(lat, ceiling) / ceiling) * (h - 12));

  // Catmull-Rom → cubic Bezier so the trend reads smooth.
  const linePath = (() => {
    if (okSamples.length === 0) return "";
    const pts = okSamples.map((s) => ({ x: xOf(s.i), y: yOf(s.latency) }));
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  })();

  const areaPath =
    okSamples.length === 0
      ? ""
      : `${linePath} L ${xOf(okSamples[okSamples.length - 1].i)} ${h - 6} L ${xOf(okSamples[0].i)} ${h - 6} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height: h }}
    >
      <defs>
        <linearGradient id="latGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {areaPath ? <path d={areaPath} fill="url(#latGrad)" stroke="none" /> : null}
      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {ordered.map((p, i) => {
        if (!p.ok) {
          return (
            <rect
              key={i}
              x={xOf(i) - 1}
              y={h - 5}
              width={2.4}
              height={4}
              fill="var(--signal-err)"
            />
          );
        }
        if (typeof p.latencyMs !== "number") return null;
        return (
          <circle
            key={i}
            cx={xOf(i)}
            cy={yOf(p.latencyMs)}
            r={1.6}
            fill="var(--accent)"
            opacity="0.85"
          />
        );
      })}
    </svg>
  );
}

export type { LatencyPoint };
