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
  // Whether `cash` (and therefore `liquid`/`total`) is the full running
  // balance (cash + income − expenses since this date) or, when this is
  // null, the plain cash-account total — see computeRunningCash.
  cashConfirmedAt: string | null;
  // Per currency: "1 X = Y <that currency>" for every source currency
  // actually converted into it while computing `cash` — empty when cash
  // didn't need converting.
  cashRateNotes: Record<string, string[]>;
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

// Converts and sums a set of same-shaped rows into `target`, skipping any row
// whose currency can't be converted (a genuinely missing FX pair) rather than
// aborting the whole total — the same per-row tolerance every other sub-total
// in computeNetWorth already uses. Records which source currencies actually
// got converted (and at what rate) into `notes`/`seen`, shared across
// multiple calls for the same target so a currency used by both cash and a
// transaction pool is only noted once.
async function sumConverted(
  rows: { amount: number; currency: string }[],
  target: string,
  fx: (from: string, to: string) => Promise<number | null>,
  seen: Set<string>,
  notes: string[],
): Promise<number> {
  let sum = 0;
  for (const row of rows) {
    const rate = await fx(row.currency, target);
    if (rate == null) continue;
    sum += Number(row.amount) * rate;
    if (row.currency !== target && !seen.has(row.currency)) {
      notes.push(`1 ${row.currency} = ${rate} ${target}`);
      seen.add(row.currency);
    }
  }
  return sum;
}

export type RunningCash = {
  // Raw user_profiles.cash_confirmed_at, or null if unavailable (no profile
  // row, or migration 015 not yet run — see the try/catch below). Callers
  // use this to tell "the full running balance" apart from the degraded
  // cash-only fallback described below.
  confirmedAt: string | null;
  // Per requested target currency: confirmed cash account balances, plus
  // income, minus expenses, dated on or after cash_confirmed_at (inclusive,
  // no upper bound — future-dated transactions count). Always a real number,
  // never null — when confirmedAt is unavailable there is no date to bound
  // the transaction query by, so this degrades to just the cash total (the
  // safest assumption: zero transactions counted, not "all of them"), which
  // is exactly what this page showed before this figure existed.
  values: Record<string, number>;
  // Per requested target currency: "1 X = Y <target>" for every distinct
  // non-target currency actually converted into it (cash, income, or
  // expense) — empty when everything involved was already in that currency.
  rateNotes: Record<string, string[]>;
};

/**
 * The one running-cash calculation, shared by the dashboard's "Money left"
 * and computeNetWorth's cash figure (previously two separate
 * implementations that disagreed — spending money moved the dashboard but
 * not net worth). Every row (cash account, income transaction, expense
 * transaction), regardless of its own currency, is converted into each
 * requested target independently via live FX — permissive by design: a
 * TWD+USD cash mix, or income in a different currency than expenses, still
 * produces a real number, the same tolerance computeNetWorth's other
 * sub-totals already have. See RunningCash for the degradation path.
 */
export async function computeRunningCash(
  supabase: SupabaseClient,
  targets: string[],
): Promise<RunningCash> {
  const fx = fxMemo(getPriceProvider());

  // cash_confirmed_at lives on user_profiles (one row per user, not per cash
  // account — transactions aren't linked to individual accounts, so a
  // per-account date would be unattributable). Wrapped defensively: until
  // migration 015 actually runs, this column doesn't exist yet and the
  // select fails with a schema-cache error, not a normal one.
  let confirmedAt: string | null = null;
  try {
    const { data: profileRow, error: profileErr } = await supabase
      .from("user_profiles")
      .select("cash_confirmed_at")
      .maybeSingle();
    if (!profileErr) {
      confirmedAt = (profileRow?.cash_confirmed_at as string | null) ?? null;
    }
  } catch {
    confirmedAt = null;
  }
  // transactions.date has no time-of-day, so "on or after" is compared at
  // day granularity — plain "YYYY-MM-DD" string comparison, not
  // timezone-aware Date math (see getMonthOverMonth for the same convention).
  const confirmedDate = confirmedAt ? confirmedAt.slice(0, 10) : null;

  const { data: cashRows, error: cashError } = await supabase
    .from("cash_accounts")
    .select("balance, currency");
  if (cashError) throw cashError;
  const cash = ((cashRows ?? []) as CashRow[]).map((c) => ({
    amount: Number(c.balance),
    currency: c.currency ?? "USD",
  }));

  let income: { amount: number; currency: string }[] = [];
  let expense: { amount: number; currency: string }[] = [];
  if (confirmedDate) {
    const [{ data: incomeRows }, { data: expenseRows }] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount, currency")
        .eq("type", "income")
        .gte("date", confirmedDate),
      supabase
        .from("transactions")
        .select("amount, currency")
        .eq("type", "expense")
        .gte("date", confirmedDate),
    ]);
    income = (incomeRows ?? []) as { amount: number; currency: string }[];
    expense = (expenseRows ?? []) as { amount: number; currency: string }[];
  }

  const values: Record<string, number> = {};
  const rateNotes: Record<string, string[]> = {};

  for (const target of targets) {
    const seen = new Set<string>();
    const notes: string[] = [];
    const cashSum = await sumConverted(cash, target, fx, seen, notes);
    const incomeSum = await sumConverted(income, target, fx, seen, notes);
    const expenseSum = await sumConverted(expense, target, fx, seen, notes);
    values[target] = cashSum + incomeSum - expenseSum;
    rateNotes[target] = notes;
  }

  return { confirmedAt, values, rateNotes };
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

  // Cash — the same running balance (confirmed cash accounts, plus income,
  // minus expenses since cash_confirmed_at) the dashboard's "Money left"
  // shows, not a raw cash_accounts sum — see computeRunningCash, the one
  // shared implementation. Fetched alongside liabilities, which don't
  // depend on it.
  const [runningCash, { data: liabilityData, error: liabilityError }] =
    await Promise.all([
      computeRunningCash(supabase, supported),
      supabase
        .from("liabilities")
        .select(
          "balance, currency, kind, interest_rate, original_principal, term_months, start_date, monthly_payment, anchor_balance, anchor_date",
        ),
    ]);
  if (liabilityError) throw liabilityError;
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
    cash[target] = runningCash.values[target] ?? 0;
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
    cashConfirmedAt: runningCash.confirmedAt,
    cashRateNotes: runningCash.rateNotes,
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
