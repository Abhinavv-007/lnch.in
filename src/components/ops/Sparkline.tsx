/**
 * Pure-SVG sparkline. No deps, supports a "shimmer" empty state and an "area"
 * fill option. Designed to fit inside StatCard headers and project cards.
 */
import { cn } from "@/lib/cn";

export default function Sparkline({
  values,
  width = 120,
  height = 32,
  stroke = "currentColor",
  fill = "currentColor",
  area = true,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  area?: boolean;
  className?: string;
}) {
  if (!values.length) {
    return (
      <div
        aria-hidden
        className={cn("h-8 w-32 rounded-md shimmer", className)}
        style={{ width, height }}
      />
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`)
    .join(" ");

  const areaPath = area
    ? `M0,${height} L ${points.replace(/ /g, " L ")} L ${width},${height} Z`
    : null;

  return (
    <svg
      role="img"
      aria-label="trend"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("text-accent", className)}
    >
      {areaPath ? <path d={areaPath} fill={fill} fillOpacity={0.12} /> : null}
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
