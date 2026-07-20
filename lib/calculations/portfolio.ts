import type { SupabaseClient } from "@supabase/supabase-js";
import { getPriceProvider } from "@/lib/prices";
import type { PriceProvider } from "@/lib/prices/types";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";

// Converts a stored ticker into the symbol Yahoo expects.
//  * "AAPL"     → "AAPL"            (US, unchanged)
//  * "0056"     → "0056.TW"         (numeric = TWSE listed)
//  * "0056.TW"  → "0056.TW"         (explicit symbol, respected as-is)
// Taiwan OTC/emerging names use ".TWO" — enter the full symbol in that case.
export function toYahooSymbol(ticker: string, currency?: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.includes(".")) return t;
  if (/^\d{3,6}$/.test(t) || currency === "TWD") return `${t}.TW`;
  return t;
}

// A holding's value expressed in one target currency, with the exact FX rates
// used so the figure is auditable. `fxRate*` is 1 when no conversion happened.
export type CurrencyValue = {
  currency: string;
  marketValue: number | null;
  cost: number | null;
  gain: number | null;
  gainPct: number | null;
  fxRateMarket: number | null; // price currency → this currency
  fxRateCost: number | null; // cost currency → this currency
};

export type HoldingValue = {
  id: string;
  ticker: string;
  shares: number;
  price: number | null;
  nativeCurrency: string; // the price's own currency = default display
  costCurrency: string;
  availableCurrencies: string[]; // currencies this holding can be shown in
  values: Record<string, CurrencyValue>;
  error?: string;
};

export type CurrencyTotal = {
  currency: string;
  marketValue: number;
  cost: number;
  gain: number;
  gainPct: number | null;
};

export type Portfolio = {
  asOf: string; // snapshot timestamp; the FX rates below were taken as of this time
  supportedCurrencies: string[]; // options offered for the total toggle
  holdings: HoldingValue[];
  totals: Record<string, CurrencyTotal>; // one total per supported currency
};

type HoldingRow = {
  id: string;
  ticker: string;
  shares: number;
  cost_basis: number;
  currency: string | null;
};

// Memoizes FX lookups so each currency pair hits the provider at most once.
function fxMemo(provider: PriceProvider) {
  const cache = new Map<string, Promise<number | null>>();
  return (from: string, to: string): Promise<number | null> => {
    if (from === to) return Promise.resolve(1);
    const key = `${from}->${to}`;
    if (!cache.has(key)) cache.set(key, provider.getFxRate(from, to));
    return cache.get(key)!;
  };
}

/**
 * Values the signed-in user's holdings with live prices. The underlying math is
 * unchanged (shares × price × fx); it's just computed once per target currency
 * so the display layer can show any holding — or the total — in USD or TWD.
 */
export async function computePortfolio(
  supabase: SupabaseClient,
): Promise<Portfolio> {
  const asOf = new Date().toISOString();

  const { data, error } = await supabase
    .from("holdings")
    .select("id, ticker, shares, cost_basis, currency")
    .order("ticker", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as HoldingRow[];

  const provider = getPriceProvider();
  const fx = fxMemo(provider);
  const supported = [...SUPPORTED_CURRENCIES];

  const symbols = [
    ...new Set(rows.map((r) => toYahooSymbol(r.ticker, r.currency ?? undefined))),
  ];
  const quotes = await provider.getQuotes(symbols);

  const holdings: HoldingValue[] = await Promise.all(
    rows.map(async (r) => {
      const shares = Number(r.shares);
      const costPerShare = Number(r.cost_basis);
      const costCurrency = r.currency ?? "USD";
      const symbol = toYahooSymbol(r.ticker, r.currency ?? undefined);
      const quote = quotes.get(symbol);
      const nativeCurrency = quote?.currency ?? costCurrency;

      // Always offer the supported currencies, plus the native one if exotic.
      const targets = [...new Set([...supported, nativeCurrency])];
      const values: Record<string, CurrencyValue> = {};

      for (const target of targets) {
        const fxRateCost = await fx(costCurrency, target);
        const cost =
          fxRateCost != null ? shares * costPerShare * fxRateCost : null;

        let fxRateMarket: number | null = null;
        let marketValue: number | null = null;
        if (quote) {
          fxRateMarket = await fx(quote.currency, target);
          marketValue =
            fxRateMarket != null ? shares * quote.price * fxRateMarket : null;
        }

        const gain =
          marketValue != null && cost != null ? marketValue - cost : null;
        const gainPct =
          gain != null && cost != null && cost !== 0
            ? (gain / cost) * 100
            : null;

        values[target] = {
          currency: target,
          marketValue,
          cost,
          gain,
          gainPct,
          fxRateMarket,
          fxRateCost,
        };
      }

      return {
        id: r.id,
        ticker: r.ticker,
        shares,
        price: quote?.price ?? null,
        nativeCurrency,
        costCurrency,
        availableCurrencies: targets,
        values,
        ...(quote ? {} : { error: `No price for ${symbol}` }),
      };
    }),
  );

  // Totals sum each holding's value in the same target currency.
  const totals: Record<string, CurrencyTotal> = {};
  for (const target of supported) {
    let marketValue = 0;
    let cost = 0;
    for (const h of holdings) {
      marketValue += h.values[target]?.marketValue ?? 0;
      cost += h.values[target]?.cost ?? 0;
    }
    const gain = marketValue - cost;
    totals[target] = {
      currency: target,
      marketValue,
      cost,
      gain,
      gainPct: cost !== 0 ? (gain / cost) * 100 : null,
    };
  }

  return { asOf, supportedCurrencies: supported, holdings, totals };
}
