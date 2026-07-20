// Provider-agnostic price interface. The rest of the app depends only on this,
// so swapping Yahoo for Twelve Data / a licensed feed later is a one-file change.

export type Quote = {
  symbol: string; // the symbol that was queried (provider-native form)
  price: number;
  currency: string; // e.g. "USD", "TWD" — the currency the price is quoted in
};

export interface PriceProvider {
  /** Resolves quotes for the given provider-native symbols. Unresolvable symbols are omitted. */
  getQuotes(symbols: string[]): Promise<Map<string, Quote>>;
  /** How many units of `to` equal 1 unit of `from`. Returns null if unavailable. */
  getFxRate(from: string, to: string): Promise<number | null>;
}
