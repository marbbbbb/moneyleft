import type { PriceProvider, Quote } from "./types";

// Yahoo Finance's public chart endpoint returns price + currency without an API
// key or crumb. It covers US and TWSE (e.g. 0056.TW) and FX pairs (TWDUSD=X).
//
// Caveat: this is an unofficial endpoint with no SLA and is not licensed to
// redistribute to other users. Fine for personal use; swap this class for a
// licensed provider before going multi-user (nothing else needs to change).
const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

// Quotes are volatile → short cache. FX moves slowly → longer cache.
const QUOTE_TTL_SECONDS = 60;
const FX_TTL_SECONDS = 300;

async function fetchMeta(
  symbol: string,
  revalidate: number,
): Promise<{ price: number; currency: string } | null> {
  const url = `${CHART}/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate },
  });
  if (!res.ok) return null;

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;

  return {
    price: meta.regularMarketPrice as number,
    currency: (meta.currency as string) ?? "USD",
  };
}

export class YahooPriceProvider implements PriceProvider {
  async getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
    const out = new Map<string, Quote>();
    // One request per symbol; personal portfolios are small and requests run in parallel.
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const meta = await fetchMeta(symbol, QUOTE_TTL_SECONDS);
          if (meta) {
            out.set(symbol, { symbol, price: meta.price, currency: meta.currency });
          }
        } catch {
          // Leave this symbol unresolved; the caller surfaces it as a per-row error.
        }
      }),
    );
    return out;
  }

  async getFxRate(from: string, to: string): Promise<number | null> {
    if (from === to) return 1;
    try {
      const meta = await fetchMeta(`${from}${to}=X`, FX_TTL_SECONDS);
      return meta?.price ?? null;
    } catch {
      return null;
    }
  }
}
