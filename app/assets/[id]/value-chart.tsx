import { valuationMidpoint, type ValuationPoint } from "@/lib/assets";

// Static SVG sparkline of valuation midpoints over time. Green if the latest is
// at or above the first, red otherwise — same convention as the portfolio.
export function ValueChart({ valuations }: { valuations: ValuationPoint[] }) {
  if (valuations.length < 2) return null;

  const sorted = [...valuations].sort(
    (a, b) => new Date(a.valued_at).getTime() - new Date(b.valued_at).getTime(),
  );
  const mids = sorted.map(valuationMidpoint);
  const min = Math.min(...mids);
  const max = Math.max(...mids);
  const span = max - min || 1;

  const W = 300;
  const H = 80;
  const padX = 4;
  const padY = 10;

  const coords = mids.map((m, i) => ({
    x: padX + (i / (mids.length - 1)) * (W - 2 * padX),
    y: padY + (1 - (m - min) / span) * (H - 2 * padY),
  }));

  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  const stroke = mids[mids.length - 1] >= mids[0] ? "#16a34a" : "#dc2626";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-20 w-full"
      role="img"
      aria-label="Value history"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={2.5} fill={stroke} />
      ))}
    </svg>
  );
}
