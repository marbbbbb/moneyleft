import type { SupabaseClient } from "@supabase/supabase-js";

// All reads go through the caller's RLS-scoped Supabase client, so these only
// ever aggregate the signed-in user's own transactions.
//
// Sign convention: a transaction's `amount` is treated as a spend magnitude as
// entered. Totals sum `amount` directly — adopt whatever sign convention you
// like for income later and these functions still work on the net figure.

export type CategoryTotal = {
  category: string;
  total: number;
  count: number;
};

// --- date helpers (no timezone conversion; transaction.date is a plain date) ---

function ymd(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** First day of the month (inclusive) and first day of the next month (exclusive). */
export function monthBounds(
  year: number,
  month1: number,
): { start: string; end: string } {
  const start = ymd(year, month1, 1);
  const nextYear = month1 === 12 ? year + 1 : year;
  const nextMonth = month1 === 12 ? 1 : month1 + 1;
  return { start, end: ymd(nextYear, nextMonth, 1) };
}

/** Sums transactions by category over [start, end). Dates are 'YYYY-MM-DD'. */
export async function getSpendingByCategory(
  supabase: SupabaseClient,
  start: string,
  end: string,
): Promise<CategoryTotal[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("category, amount")
    .eq("type", "expense") // spending totals count expenses only, never income
    .gte("date", start)
    .lt("date", end);

  if (error) throw error;

  const totals = new Map<string, CategoryTotal>();
  for (const row of data ?? []) {
    const category = (row.category as string) || "Uncategorized";
    const entry = totals.get(category) ?? { category, total: 0, count: 0 };
    entry.total += Number(row.amount) || 0;
    entry.count += 1;
    totals.set(category, entry);
  }

  return [...totals.values()].sort((a, b) => b.total - a.total);
}

export type PeriodSummary = {
  start: string;
  end: string;
  total: number;
  byCategory: CategoryTotal[];
};

export type CategoryDelta = {
  category: string;
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null; // null when there was no spending in the previous period
};

export type MonthOverMonth = {
  current: PeriodSummary;
  previous: PeriodSummary;
  deltaTotal: number;
  deltaPct: number | null;
  byCategory: CategoryDelta[];
};

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Compares the reference month against the one before it, overall and per
 * category. Defaults to the current month.
 */
export async function getMonthOverMonth(
  supabase: SupabaseClient,
  reference: Date = new Date(),
): Promise<MonthOverMonth> {
  const year = reference.getFullYear();
  const month1 = reference.getMonth() + 1; // 1–12

  const prevYear = month1 === 1 ? year - 1 : year;
  const prevMonth1 = month1 === 1 ? 12 : month1 - 1;

  const curBounds = monthBounds(year, month1);
  const prevBounds = monthBounds(prevYear, prevMonth1);

  const [curCats, prevCats] = await Promise.all([
    getSpendingByCategory(supabase, curBounds.start, curBounds.end),
    getSpendingByCategory(supabase, prevBounds.start, prevBounds.end),
  ]);

  const sum = (cats: CategoryTotal[]) => cats.reduce((s, c) => s + c.total, 0);
  const curTotal = sum(curCats);
  const prevTotal = sum(prevCats);

  const curMap = new Map(curCats.map((c) => [c.category, c.total]));
  const prevMap = new Map(prevCats.map((c) => [c.category, c.total]));

  const byCategory: CategoryDelta[] = [...new Set([...curMap.keys(), ...prevMap.keys()])]
    .map((category) => {
      const current = curMap.get(category) ?? 0;
      const previous = prevMap.get(category) ?? 0;
      return {
        category,
        current,
        previous,
        delta: current - previous,
        deltaPct: percentChange(current, previous),
      };
    })
    .sort((a, b) => b.current - a.current);

  return {
    current: { ...curBounds, total: curTotal, byCategory: curCats },
    previous: { ...prevBounds, total: prevTotal, byCategory: prevCats },
    deltaTotal: curTotal - prevTotal,
    deltaPct: percentChange(curTotal, prevTotal),
    byCategory,
  };
}
