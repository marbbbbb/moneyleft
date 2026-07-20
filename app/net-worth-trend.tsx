// Net worth over time, as a plain SVG line chart. Points come from
// net_worth_snapshots — a forward-only log (see lib/calculations/snapshots.ts).
// There is no retroactive history: cash balances and holdings only ever store
// their CURRENT value, so this chart is necessarily sparse for new accounts and
// fills in day by day. Never fabricate a point that wasn't actually recorded.

export type TrendPoint = { date: string; value: number };

function money(n: number, currency: string): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;
}

export function NetWorthTrend({
  points,
  currency,
}: {
  points: TrendPoint[];
  currency: string;
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No history recorded yet — check back after your next visit.
      </p>
    );
  }

  if (points.length === 1) {
    return (
      <p className="text-sm text-gray-500">
        Today&apos;s net worth is the first recorded point (
        {money(points[0].value, currency)}). The trend line will appear once a
        few more days of history build up — nothing here is backfilled.
      </p>
    );
  }

  const width = 600;
  const height = 160;
  const padX = 8;
  const padY = 16;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * (width - 2 * padX);
    const y = padY + (1 - (p.value - min) / span) * (height - 2 * padY);
    return { x, y, ...p };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const trendUp = last.value >= first.value;
  const strokeClass = trendUp ? "stroke-green-600" : "stroke-red-600";
  const dotClass = trendUp ? "fill-green-600" : "fill-red-600";

  const sparse = points.length < 5;

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label="Net worth over time"
      >
        <path d={path} fill="none" className={strokeClass} strokeWidth={2} />
        {/* Sparse history is honest, not decorative — show every real point. */}
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={sparse ? 3 : 2} className={dotClass} />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {new Date(first.date).toLocaleDateString()} · {money(first.value, currency)}
        </span>
        <span>
          {new Date(last.date).toLocaleDateString()} · {money(last.value, currency)}
        </span>
      </div>
      {sparse && (
        <p className="text-xs text-gray-400">
          Still filling in — {points.length} day{points.length === 1 ? "" : "s"}{" "}
          recorded so far. This only tracks forward from when you started using
          the app; there&apos;s no way to reconstruct earlier history.
        </p>
      )}
    </div>
  );
}
