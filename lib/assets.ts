// Asset categories offered in the UI. Values must match the DB enum
// `asset_category`. Kept in a plain module so both client forms and server
// actions can import it.
export const ASSET_CATEGORIES = [
  { value: "real_estate", label: "Real estate" },
  { value: "vehicle", label: "Vehicle" },
  { value: "precious_metal", label: "Gold / precious metal" },
  { value: "jewelry", label: "Jewelry" },
  { value: "trading_card", label: "Trading card" },
  { value: "art", label: "Art" },
  { value: "antique", label: "Antique" },
  { value: "electronics", label: "Electronics" },
  { value: "clothing", label: "Clothing" },
  { value: "other", label: "Other" },
] as const;

export const ASSET_CATEGORY_VALUES = ASSET_CATEGORIES.map((c) => c.value);

export function assetCategoryLabel(value: string): string {
  return ASSET_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// Asset values are typically large (real estate, cars) — whole units read cleaner.
export function formatAssetMoney(n: number, currency: string): string {
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} ${currency}`;
}

// A valuation always displays as a range. A tight (low === high) range collapses
// to a single figure so manual entries don't read as "500,000 – 500,000".
export function formatRange(
  low: number,
  high: number,
  currency: string,
): string {
  if (low === high) return formatAssetMoney(low, currency);
  return `${formatAssetMoney(low, currency)} – ${formatAssetMoney(high, currency)}`;
}

export function confidenceClass(level: string): string {
  switch (level) {
    case "high":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "medium":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    default:
      return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
  }
}

// --- change-over-time helpers (work off the asset_valuations time series) ---

export type ValuationPoint = {
  value_low: number;
  value_high: number;
  currency: string;
  valued_at: string;
};

// A range collapses to a single number (its midpoint) for trend/change math,
// consistent with how illiquid net worth is computed.
export function valuationMidpoint(v: {
  value_low: number;
  value_high: number;
}): number {
  return (Number(v.value_low) + Number(v.value_high)) / 2;
}

/**
 * Returns the most recent valuation from a series, or null if empty.
 * Ties on `valued_at` resolve by `created_at` (when the row was recorded), so
 * the newest-recorded valuation always wins rather than an arbitrary one.
 */
export function latestValuation<T extends { valued_at: string; created_at?: string }>(
  points: T[],
): T | null {
  if (points.length === 0) return null;
  return [...points].sort((a, b) => {
    const byValuedAt =
      new Date(b.valued_at).getTime() - new Date(a.valued_at).getTime();
    if (byValuedAt !== 0) return byValuedAt;
    return (
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );
  })[0];
}

export type AssetChange = {
  absolute: number;
  pct: number | null; // null when the purchase price was 0
};

/**
 * Change from the fixed purchase price to the latest valuation's midpoint —
 * the asset analogue of a stock's cost basis vs market value.
 */
export function changeVsPurchase(
  purchasePrice: number,
  latest: { value_low: number; value_high: number },
): AssetChange {
  const absolute = valuationMidpoint(latest) - purchasePrice;
  return {
    absolute,
    pct: purchasePrice !== 0 ? (absolute / purchasePrice) * 100 : null,
  };
}

export function formatSignedMoney(n: number, currency: string): string {
  return `${n >= 0 ? "+" : "−"}${formatAssetMoney(Math.abs(n), currency)}`;
}

export function changeColorClass(n: number): string {
  return n >= 0 ? "text-green-600" : "text-red-600";
}

// --- valuation source display (badge label + styling) ---

// A valuation's method is derivable from its DB source + the asset's category,
// which is exactly how the engine routes strategies.
export function valuationSourceLabel(source: string, category: string): string {
  if (source === "manual") return "manual";
  if (source === "appraisal") return "appraisal";
  if (source === "market") {
    if (category === "precious_metal") return "live market";
    if (category === "vehicle") return "market/depreciation";
    return "market";
  }
  // ai_estimate
  if (["trading_card", "watch", "real_estate"].includes(category)) {
    return "comps via web";
  }
  return "AI estimate";
}

export function isAiSource(source: string): boolean {
  return source === "ai_estimate";
}

// Real market data reads blue; AI estimates read purple — a clear visual split.
export function sourceBadgeClass(source: string): string {
  if (source === "ai_estimate") {
    return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
  }
  if (source === "market") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  }
  return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
}
