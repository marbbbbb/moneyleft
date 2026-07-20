// Pure ticker helpers — no server-only imports, safe in Client Components.

export const SUPPORTED_CURRENCIES = ["USD", "TWD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Best-guess trading currency from a ticker:
 *  - "0056", "2330"      → TWD (numeric = TWSE listed)
 *  - "0056.TW", "xxx.TWO"→ TWD (explicit Taiwan symbol)
 *  - "AAPL", everything else → USD
 * This is only a default; the user can override it in the form.
 */
export function deriveCurrency(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (/\.TWO?$/.test(t)) return "TWD";
  if (/^\d{3,6}[A-Z]?$/.test(t)) return "TWD";
  return "USD";
}
