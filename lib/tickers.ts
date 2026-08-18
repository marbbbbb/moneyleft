// Pure ticker helpers — no server-only imports, safe in Client Components.

import { CURRENCY_CODES } from "./currencies";

// Derived from lib/currencies.ts, the single place a supported currency is
// declared. Kept as its own export (rather than switching every consumer over
// to lib/currencies.ts) so none of the existing currency pickers/validators
// across cash, holdings, liabilities, assets, and transactions need to change
// — same values, same shape, just sourced from one place now.
export const SUPPORTED_CURRENCIES = CURRENCY_CODES;
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
