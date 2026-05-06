type LatencyPoint = { ts: number; latencyMs: number | null; ok: boolean };

/**
 * Tiny SVG sparkline of recent probe latency. Renders ok points as the
 * accent color and failed probes as red ticks at the bottom of the strip.
 */
export default function LatencyStrip({
  points,
  maxLatency,
  height = 36,
}: {
  points: LatencyPoint[];
  maxLatency?: number;
  height?: number;
}) {
  if (!points || points.length === 0) {
    return <div className="text-xs text-muted">no probes yet</div>;
  }
  const reversed = [...points].reverse(); // chronological ASC
  const ceiling =
    maxLatency ??
    Math.max(
      80,
      ...reversed.map((p) => (typeof p.latencyMs === "number" ? p.latencyMs : 0)),
    );
  const w = Math.max(reversed.length, 24) * 6;
  const path = reversed
    .map((p, i) => {
      const x = i * 6;
      const y =
        typeof p.latencyMs === "number"
          ? Math.max(2, height - 2 - (p.latencyMs / ceiling) * (height - 6))
          : height - 2;
      return `${i === 0 ? "M" : "L"} ${x} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height }}
    >
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      {reversed.map((p, i) =>
        !p.ok ? (
          <rect
            key={i}
            x={i * 6 - 1}
            y={height - 4}
            width={2}
            height={3}
            fill="var(--signal-err)"
          />
        ) : null,
      )}
    </svg>
  );
}

export type { LatencyPoint };
