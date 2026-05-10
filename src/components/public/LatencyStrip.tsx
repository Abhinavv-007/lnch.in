type LatencyPoint = { ts: number; latencyMs: number | null; ok: boolean };

/**
 * Recent-latency signal strip shown in the public landing's "latency · 24h"
 * poster.
 *
 * The previous version was a smoothed area-fill spline that looked like a
 * mountain range — peaks-and-valleys terrain that didn't read as data.
 * This version renders the strip as a real **signal trace**:
 *
 *   - one thin candle per probe sample (height = latency, colour by tier)
 *   - a dim mid-line at the rolling median, so spikes read against a
 *     reference rather than against zero
 *   - small accent dots on every ok sample so the trace stays legible at
 *     a glance even when the candles are short
 *   - red ticks at the bottom for failed probes (separate row, not folded
 *     into the trace)
 *
 * The result reads like a network telemetry strip — bars rising off a
 * baseline — not a landscape silhouette.
 */
export default function LatencyStrip({
  points,
  maxLatency,
  height = 56,
}: {
  points: LatencyPoint[];
  maxLatency?: number;
  height?: number;
}) {
  if (!points || points.length === 0) {
    return <div className="text-xs text-muted">no probes yet</div>;
  }

  // Chronological ASC so the trace reads left → right with time.
  const ordered = [...points].sort((a, b) => a.ts - b.ts);
  const COL_W = 8;
  // Reserve a 4px lane at the bottom for failure ticks so they never
  // collide with the actual signal candles.
  const FAIL_LANE = 4;
  const top = 6;
  const bot = height - 6 - FAIL_LANE;
  const usable = bot - top;

  const w = Math.max(ordered.length, 24) * COL_W;

  const okValues = ordered
    .map((p) => (p.ok && typeof p.latencyMs === "number" ? p.latencyMs : null))
    .filter((v): v is number => v !== null);

  // Cap ceiling so a single 3500ms outlier doesn't squash everything else
  // to a flat line at the bottom of the strip. Use a multiple of the
  // median rather than the max.
  const sorted = okValues.slice().sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 100;
  const dynamicCeiling = Math.max(median * 5, 120);
  const ceiling = maxLatency ?? Math.min(dynamicCeiling, 2_500);

  const yOf = (lat: number) =>
    bot - (Math.min(lat, ceiling) / ceiling) * usable;

  const xOf = (idx: number) => idx * COL_W + COL_W / 2;

  // Two warning thresholds: amber once a sample is > 2× median, red over
  // the dynamic ceiling. Below median = ok-green; gives the strip a clear
  // "fast / nominal / slow" tier read.
  const tierColour = (lat: number): string => {
    if (lat > ceiling * 0.9) return "var(--signal-err)";
    if (lat > median * 2) return "var(--signal-warn)";
    if (lat <= median * 1.1) return "var(--signal-ok)";
    return "var(--accent)";
  };

  const medianY = okValues.length ? yOf(median) : null;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height }}
      aria-label="latency signal strip"
    >
      <defs>
        <linearGradient id="latStripBase" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Faint signal-lane background — keeps the strip grounded against
          the poster paper without reading as a mountain range. */}
      <rect
        x={0}
        y={top}
        width={w}
        height={usable}
        fill="url(#latStripBase)"
      />

      {/* Median reference line. Dim-accent dashed; the candles read as
          deltas against this rather than against the baseline. */}
      {medianY != null ? (
        <line
          x1={0}
          x2={w}
          y1={medianY}
          y2={medianY}
          stroke="var(--accent)"
          strokeOpacity="0.32"
          strokeDasharray="2 4"
          strokeWidth="1"
        />
      ) : null}

      {/* Per-sample candles. Failures get a red tick in the FAIL_LANE
          beneath the trace so the trace stays honest. */}
      {ordered.map((p, i) => {
        if (!p.ok) {
          return (
            <rect
              key={i}
              x={xOf(i) - 1.4}
              y={height - FAIL_LANE - 1}
              width={2.8}
              height={FAIL_LANE}
              fill="var(--signal-err)"
              rx={0.6}
            />
          );
        }
        if (typeof p.latencyMs !== "number") return null;
        const y = yOf(p.latencyMs);
        const colour = tierColour(p.latencyMs);
        return (
          <g key={i}>
            <rect
              x={xOf(i) - 1}
              y={y}
              width={2}
              height={Math.max(2, bot - y)}
              fill={colour}
              opacity="0.55"
              rx={0.7}
            />
            <circle cx={xOf(i)} cy={y} r={1.7} fill={colour} />
          </g>
        );
      })}
    </svg>
  );
}

export type { LatencyPoint };
