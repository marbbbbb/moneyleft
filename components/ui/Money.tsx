type MoneySize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl";

interface MoneyProps {
  amount: number;
  currency: string;
  signed?: boolean;
  size?: MoneySize;
  className?: string;
}

const sizeVar: Record<MoneySize, string> = {
  xs: "var(--t-xs)",
  sm: "var(--t-sm)",
  base: "var(--t-base)",
  lg: "var(--t-lg)",
  xl: "var(--t-xl)",
  "2xl": "var(--t-2xl)",
};

export function Money({
  amount,
  currency,
  signed = false,
  size = "base",
  className = "",
}: MoneyProps) {
  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(amount);

  const colorClass = signed
    ? amount > 0
      ? "text-[var(--pos)]"
      : amount < 0
        ? "text-[var(--neg)]"
        : "text-[var(--text)]"
    : "text-[var(--text)]";

  return (
    <span
      className={`tnum ${colorClass} ${className}`}
      style={{ fontSize: sizeVar[size] }}
    >
      {formatted}
    </span>
  );
}
