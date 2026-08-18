// Single source of truth for supported currencies. Pure module - no
// server-only imports, safe in Client Components. Adding a currency is meant
// to be a single new entry in CURRENCIES; see the note in this file's
// consumers for anything else that would need touching (mainly: FX rate
// coverage in lib/prices, which is data, not code, for a new pair).

export type CurrencyOption = {
  code: string; // ISO 4217
  label: string; // human-readable name, shown next to the code in pickers
  placeholder: number; // sample amount at this currency's typical scale, for input placeholders
};

export const CURRENCIES: CurrencyOption[] = [
  { code: "TWD", label: "New Taiwan Dollar", placeholder: 40000 },
  { code: "USD", label: "US Dollar", placeholder: 1500 },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function currencyPlaceholder(code: string): number {
  return CURRENCIES.find((c) => c.code === code)?.placeholder ?? CURRENCIES[0].placeholder;
}
