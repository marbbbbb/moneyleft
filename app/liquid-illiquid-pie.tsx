// Simple two-segment pie chart (liquid vs illiquid), pure SVG — no chart
// library. Percentages + a legend, same green/neutral convention as before.

function point(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = (Math.PI / 180) * angleDeg;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

// Clockwise wedge from startAngle to endAngle (0deg = 12 o'clock).
function wedgePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const [x1, y1] = point(cx, cy, r, startAngle);
  const [x2, y2] = point(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
}

export function LiquidIlliquidPie({
  liquid,
  illiquid,
}: {
  liquid: number;
  illiquid: number;
}) {
  const total = liquid + illiquid;
  const size = 160;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;

  const liquidPct = total > 0 ? (liquid / total) * 100 : 0;
  const illiquidPct = total > 0 ? 100 - liquidPct : 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-32 w-32 shrink-0" role="img" aria-label="Liquid vs illiquid split">
        {total <= 0 ? (
          <circle cx={cx} cy={cy} r={r} className="fill-[var(--border)]" />
        ) : liquidPct >= 99.95 ? (
          <circle cx={cx} cy={cy} r={r} className="fill-[var(--pos)]" />
        ) : illiquidPct >= 99.95 ? (
          <circle cx={cx} cy={cy} r={r} className="fill-[var(--text-subtle)]" />
        ) : (
          <>
            <path
              d={wedgePath(cx, cy, r, 0, (liquidPct / 100) * 360)}
              className="fill-[var(--pos)]"
            />
            <path
              d={wedgePath(cx, cy, r, (liquidPct / 100) * 360, 360)}
              className="fill-[var(--text-subtle)]"
            />
          </>
        )}
      </svg>

      <div className="flex flex-col gap-2 text-sm">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--pos)]" />
          Liquid <span className="text-[var(--text-muted)]">{liquidPct.toFixed(0)}%</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--text-subtle)]" />
          Illiquid <span className="text-[var(--text-muted)]">{illiquidPct.toFixed(0)}%</span>
        </span>
        {total <= 0 && (
          <span className="text-xs text-[var(--text-subtle)]">No liquid or illiquid value yet.</span>
        )}
      </div>
    </div>
  );
}
