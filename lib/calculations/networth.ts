import type { SupabaseClient } from "@supabase/supabase-js";
import { getPriceProvider } from "@/lib/prices";
import type { PriceProvider } from "@/lib/prices/types";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import { currentBalance } from "@/lib/amortization";
import { computePortfolio } from "./portfolio";

// Net worth, expressed in each supported currency so the view can toggle.
//  liquid   = cash accounts + stock holdings (market value)
//  illiquid = assets (current value = latest valuation midpoints)
// assetCost / assetGain track unrealized gain (purchase price → current value)
// across assets that have both a purchase price and a valuation.
export type NetWorth = {
  asOf: string;
  supportedCurrencies: string[];
  fxRates: Record<string, Record<string, number | null>>; // fxRates[from][to]
  cash: Record<string, number>;
  holdings: Record<string, number>;
  liquid: Record<string, number>;
  illiquid: Record<string, number>;
  assetCost: Record<string, number>;
  assetGain: Record<string, number>;
  assetGainPct: Record<string, number | null>;
  liabilities: Record<string, number>;
  total: Record<string, number>; // liquid + illiquid − liabilities
};

type CashRow = { balance: number; currency: string | null };
// Matches lib/amortization.ts's LiabilityLike shape, plus `currency` (which
// that module doesn't need) — a superset, so rows here pass through to
// currentBalance() directly with no adapter.
type LiabilityRow = {
  balance: number;
  currency: string | null;
  kind: string;
  interest_rate: number | null;
  original_principal: number | null;
  term_months: number | null;
  start_date: string | null;
  monthly_payment: number | null;
  anchor_balance: number | null;
  anchor_date: string | null;
};
type ValuationRow = {
  asset_id: string;
  value_low: number;
  value_high: number;
  currency: string | null;
};
type AssetRow = {
  id: string;
  acquisition_cost: number | null;
  currency: string | null;
};

function fxMemo(provider: PriceProvider) {
  const cache = new Map<string, Promise<number | null>>();
  return (from: string, to: string): Promise<number | null> => {
    if (from === to) return Promise.resolve(1);
    const key = `${from}->${to}`;
    if (!cache.has(key)) cache.set(key, provider.getFxRate(from, to));
    return cache.get(key)!;
  };
}

export async function computeNetWorth(
  supabase: SupabaseClient,
): Promise<NetWorth> {
  const now = new Date();
  const asOf = now.toISOString();
  const supported = [...SUPPORTED_CURRENCIES];
  const provider = getPriceProvider();
  const fx = fxMemo(provider);

  // Stock holdings — reuse the existing dual-currency portfolio math.
  const portfolio = await computePortfolio(supabase);

  // Cash accounts (liquid) and liabilities (debts).
  const [{ data, error }, { data: liabilityData, error: liabilityError }] =
    await Promise.all([
      supabase.from("cash_accounts").select("balance, currency"),
      supabase
        .from("liabilities")
        .select(
          "balance, currency, kind, interest_rate, original_principal, term_months, start_date, monthly_payment, anchor_balance, anchor_date",
        ),
    ]);
  if (error) throw error;
  if (liabilityError) throw liabilityError;
  const cashRows = (data ?? []) as CashRow[];
  const liabilityRows = (liabilityData ?? []) as LiabilityRow[];

  // Derived once per row (independent of display currency) — the single call
  // site for amortization math in net worth. Simple liabilities pass through
  // currentBalance() as a no-op (it just returns the stored balance).
  const liabilityBalances = liabilityRows.map((row) => ({
    balance: currentBalance(row, now),
    currency: row.currency,
  }));

  // Illiquid assets: latest valuation per asset (the view returns one row each),
  // matched to the asset for its fixed purchase price.
  const [{ data: valuationData, error: valuationError }, { data: assetData, error: assetError }] =
    await Promise.all([
      supabase
        .from("asset_current_valuations")
        .select("asset_id, value_low, value_high, currency"),
      supabase.from("assets").select("id, acquisition_cost, currency"),
    ]);
  if (valuationError) throw valuationError;
  if (assetError) throw assetError;

  const valuationRows = (valuationData ?? []) as ValuationRow[];
  const assetRows = (assetData ?? []) as AssetRow[];
  const latestByAsset = new Map(valuationRows.map((v) => [v.asset_id, v]));

  const cash: Record<string, number> = {};
  const holdings: Record<string, number> = {};
  const liquid: Record<string, number> = {};
  const illiquid: Record<string, number> = {};
  const assetCost: Record<string, number> = {};
  const assetGain: Record<string, number> = {};
  const assetGainPct: Record<string, number | null> = {};
  const liabilities: Record<string, number> = {};
  const total: Record<string, number> = {};

  for (const target of supported) {
    let cashSum = 0;
    for (const row of cashRows) {
      const rate = await fx(row.currency ?? "USD", target);
      if (rate != null) cashSum += Number(row.balance) * rate;
    }
    cash[target] = cashSum;
    holdings[target] = portfolio.totals[target]?.marketValue ?? 0;
    liquid[target] = cash[target] + holdings[target];

    // Debts, FX-converted, subtracted from net worth.
    let liabilitySum = 0;
    for (const row of liabilityBalances) {
      const rate = await fx(row.currency ?? "USD", target);
      if (rate != null) liabilitySum += row.balance * rate;
    }
    liabilities[target] = liabilitySum;

    // Walk assets once: current value feeds illiquid; assets that also have a
    // purchase price contribute to the unrealized-gain totals.
    let illiquidSum = 0;
    let gainCurrent = 0;
    let gainCost = 0;
    for (const asset of assetRows) {
      const v = latestByAsset.get(asset.id);
      if (!v) continue;
      const valRate = await fx(v.currency ?? "USD", target);
      if (valRate == null) continue;
      const currentConverted =
        ((Number(v.value_low) + Number(v.value_high)) / 2) * valRate;
      illiquidSum += currentConverted;

      if (asset.acquisition_cost != null) {
        const costRate = await fx(asset.currency ?? "USD", target);
        if (costRate != null) {
          gainCurrent += currentConverted;
          gainCost += Number(asset.acquisition_cost) * costRate;
        }
      }
    }
    illiquid[target] = illiquidSum;
    assetCost[target] = gainCost;
    assetGain[target] = gainCurrent - gainCost;
    assetGainPct[target] =
      gainCost !== 0 ? (assetGain[target] / gainCost) * 100 : null;
    total[target] = liquid[target] + illiquid[target] - liabilities[target];
  }

  // Pairwise FX rates for the audit line.
  const fxRates: Record<string, Record<string, number | null>> = {};
  for (const from of supported) {
    fxRates[from] = {};
    for (const to of supported) {
      fxRates[from][to] = await fx(from, to);
    }
  }

  return {
    asOf,
    supportedCurrencies: supported,
    fxRates,
    cash,
    holdings,
    liquid,
    illiquid,
    assetCost,
    assetGain,
    assetGainPct,
    liabilities,
    total,
  };
}
