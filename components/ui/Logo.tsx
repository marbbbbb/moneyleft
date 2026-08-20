// M/L monogram, also readable as a chart line: falls, recovers, falls again,
// then runs out along a baseline. Two bezier paths meeting at (14,15) - the
// low point - where the stroke colour changes from the primary text colour
// to --pos, so the line reads as one continuous stroke with a colour
// changeover, not two separate strokes. Geometry is final; do not edit the
// path data.
const ICON_SIZE = 24;
const ICON_STROKE = 3.2;
const DISPLAY_SIZE = 32;
const DISPLAY_STROKE = 2.4;

// Stroke width scales inversely with rendered size (thicker relative to a
// smaller canvas) so the line doesn't thin out to nothing at icon scale.
// `size` is the caller's representative rendered height in px - a hint for
// picking one fixed stroke width in the (fixed) 0 0 42 26 viewBox's own
// coordinate units, not a live/continuous measurement.
function strokeWidthFor(size: number): number {
  const t = (size - ICON_SIZE) / (DISPLAY_SIZE - ICON_SIZE);
  const raw = ICON_STROKE + t * (DISPLAY_STROKE - ICON_STROKE);
  return Math.min(Math.max(raw, DISPLAY_STROKE), ICON_STROKE);
}

export function Logo({
  className,
  size = DISPLAY_SIZE,
}: {
  className?: string;
  size?: number;
}) {
  const strokeWidth = strokeWidthFor(size);

  return (
    <svg
      viewBox="0 0 42 26"
      fill="none"
      className={className}
      role="img"
      aria-label="MoneyLeft"
    >
      <path
        d="M3 23 C3 9, 4 3, 6 3 C9 3, 11 13, 14 15"
        stroke="var(--text)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 15 C17 17, 19 3, 23 3 C26 3, 26 12, 26 23 C30 23, 34 23, 39 22"
        stroke="var(--pos)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
