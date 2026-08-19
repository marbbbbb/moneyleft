import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMonthOverMonth, type MonthOverMonth } from "@/lib/calculations/spending";
import { getPriceProvider } from "@/lib/prices";
import { Card, PageHeader, Money } from "@/components/ui";
import { CategoryDisclosure } from "./category-disclosure";

const SPENDING_CURRENCY = "TWD";

// Same button styling as <Button variant="secondary">, applied to a real <a>
// instead — Button only renders a native <button>, and nesting one inside a
// Link's <a> is invalid HTML for a control that's pure navigation, not a submit.
const MANAGE_LINK_CLASS =
  "inline-flex items-center justify-center px-[var(--sp-3)] py-[var(--sp-2)] rounded-[var(--r-sm)] text-[length:var(--t-sm)] font-medium bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]";

function formatMonth(startYmd: string): string {
  const [y, m] = startYmd.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// Converts a same-single-currency amount into TWD via the same live FX
// provider the net-worth page uses, WITHOUT pulling in its full
// computeNetWorth pipeline (portfolio prices, assets, liabilities) just for
// one rate lookup.
async function convertToTWD(
  amount: number,
  currency: string,
): Promise<{ value: number | null; rate: number | null }> {
  if (currency === "TWD") return { value: amount, rate: null };
  const rate = await getPriceProvider().getFxRate(currency, "TWD");
  return { value: rate != null ? amount * rate : null, rate };
}

// Total amount and the single currency it's in, if there is one - the same
// "single currency or mixed" determination used everywhere in this app that
// sums money, just factored out since Money left now needs it for two pools
// (income, expense) instead of one.
function summarizeRows(rows: { amount: number; currency: string }[]) {
  const currencies = new Set(rows.map((r) => r.currency));
  return {
    total: rows.reduce((sum, r) => sum + Number(r.amount), 0),
    mixed: currencies.size > 1,
    currency: currencies.size === 1 ? [...currencies][0] : null,
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // First login: send new users through the onboarding quiz before anything else.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_completed_at")
    .maybeSingle();
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  // Spending calculations layer — degrade gracefully if the table isn't ready.
  let mom: MonthOverMonth | null = null;
  try {
    mom = await getMonthOverMonth(supabase);
  } catch {
    mom = null;
  }

  // Recomputed here (rather than trusting mom.deltaPct) so the delta amount,
  // direction indicator, and percent are guaranteed to agree with each other.
  const deltaTotal = mom ? mom.current.total - mom.previous.total : 0;
  const deltaPct =
    mom && mom.previous.total !== 0
      ? (deltaTotal / mom.previous.total) * 100
      : null;

  // Transactions can now be mixed-currency (phase 1 of multi-currency). There's
  // no conversion yet, so mom.current.total is a raw sum that's only honest to
  // label with a currency symbol when every expense this month actually shares
  // one. Scoped to just the headline total for now — the delta line and the
  // per-category rows below still assume SPENDING_CURRENCY, a known gap.
  let totalCurrency: string | null = null;
  let mixedCurrency = false;
  if (mom) {
    const { data: currencyRows } = await supabase
      .from("transactions")
      .select("currency")
      .eq("type", "expense")
      .gte("date", mom.current.start)
      .lt("date", mom.current.end);
    const distinct = new Set((currencyRows ?? []).map((r) => r.currency as string));
    if (distinct.size === 1) totalCurrency = [...distinct][0];
    else if (distinct.size > 1) mixedCurrency = true;
  }

  // Cash accounts — same lightweight select shape /cash and computeNetWorth
  // both already use; deliberately NOT calling computeNetWorth here, since
  // that also fetches live portfolio prices, assets, and liabilities this
  // card doesn't need.
  const { data: cashRows } = await supabase
    .from("cash_accounts")
    .select("balance, currency");
  const cash = (cashRows ?? []) as { balance: number; currency: string }[];
  const distinctCash = new Set(cash.map((c) => c.currency));
  const cashMixed = distinctCash.size > 1;
  const cashCurrency = distinctCash.size === 1 ? [...distinctCash][0] : null;
  const cashTotal = cash.reduce((sum, c) => sum + Number(c.balance), 0);

  // cash_confirmed_at lives on user_profiles (one row per user, not per cash
  // account — transactions aren't linked to individual accounts, so a
  // per-account date would be unattributable). Wrapped defensively: until
  // migration 015 actually runs, this column doesn't exist yet and the
  // select fails with a schema-cache error, not a normal one — degrade to
  // "unavailable" rather than crashing the page.
  let cashConfirmedAt: string | null = null;
  try {
    const { data: profileRow, error: profileErr } = await supabase
      .from("user_profiles")
      .select("cash_confirmed_at")
      .maybeSingle();
    if (!profileErr) {
      cashConfirmedAt = (profileRow?.cash_confirmed_at as string | null) ?? null;
    }
  } catch {
    cashConfirmedAt = null;
  }
  // transactions.date has no time-of-day, so "on or after" is compared at day
  // granularity — same plain "YYYY-MM-DD" string comparison every other
  // transactions.date range query in this app already uses (see
  // getMonthOverMonth), not timezone-aware Date math.
  const confirmedDate = cashConfirmedAt ? cashConfirmedAt.slice(0, 10) : null;
  const confirmedDateLabel = cashConfirmedAt
    ? new Date(cashConfirmedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // Money left = cash + income since cash_confirmed_at − expenses since
  // cash_confirmed_at, resolved into TWD. Inclusive of the confirmed date;
  // no upper bound, so future-dated transactions count too. Only computed
  // when cash and each transaction pool (income, expense) are themselves a
  // single currency — otherwise combining would silently mix currencies,
  // which this app never does. Any side that isn't already TWD is converted
  // via the live FX rate (see convertToTWD) rather than assumed.
  let moneyLeft: number | null = null;
  let moneyLeftFxNote: string | null = null;
  let moneyLeftMixedCurrency = false;

  if (confirmedDate && cash.length > 0 && cashCurrency && !cashMixed) {
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

    const income = summarizeRows((incomeRows ?? []) as { amount: number; currency: string }[]);
    const expense = summarizeRows((expenseRows ?? []) as { amount: number; currency: string }[]);
    moneyLeftMixedCurrency = income.mixed || expense.mixed;

    if (!moneyLeftMixedCurrency) {
      const cashConv = await convertToTWD(cashTotal, cashCurrency);
      // A zero pool has no real currency to get wrong; only resolve/convert
      // a real one when there's an actual amount — same "zero has no
      // currency" reasoning the old savings-target term used.
      const incomeConv =
        income.total > 0 && income.currency
          ? await convertToTWD(income.total, income.currency)
          : { value: 0, rate: null };
      const expenseConv =
        expense.total > 0 && expense.currency
          ? await convertToTWD(expense.total, expense.currency)
          : { value: 0, rate: null };

      if (cashConv.value != null && incomeConv.value != null && expenseConv.value != null) {
        moneyLeft = cashConv.value + incomeConv.value - expenseConv.value;
        const seen = new Set<string>();
        const rateNotes: string[] = [];
        for (const [curr, conv] of [
          [cashCurrency, cashConv],
          [income.currency, incomeConv],
          [expense.currency, expenseConv],
        ] as [string | null, { rate: number | null }][]) {
          if (curr && conv.rate != null && !seen.has(curr)) {
            rateNotes.push(`1 ${curr} = ${conv.rate} TWD`);
            seen.add(curr);
          }
        }
        if (rateNotes.length > 0) moneyLeftFxNote = `Converted at ${rateNotes.join(", ")}.`;
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-[var(--sp-6)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <PageHeader title="Dashboard" />

      <Card>
        {/* Held line + hero. One group: no divider between them, just extra
            breathing room before the hero. */}
        <p className="text-[length:var(--t-sm)] text-[var(--text-muted)]">Cash</p>

        {cash.length === 0 ? (
          <p className="mt-[var(--sp-2)] text-[length:var(--t-sm)] text-[var(--text-muted)]">
            No cash accounts yet — add one to see your money left.
          </p>
        ) : (
          <>
            {cashMixed ? (
              <>
                <span className="tnum font-mono mt-[var(--sp-1)] block text-[length:var(--t-sm)] text-[var(--text)]">
                  {cashTotal.toFixed(2)}
                </span>
                <p className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  (mixed currencies)
                </p>
              </>
            ) : (
              <Money
                amount={cashTotal}
                currency={cashCurrency ?? SPENDING_CURRENCY}
                size="sm"
                className="mt-[var(--sp-1)] block font-medium"
              />
            )}

            <p className="mt-[var(--sp-6)] text-[length:var(--t-sm)] text-[var(--text-muted)]">
              Money left
            </p>
            {moneyLeft !== null ? (
              <>
                <Money
                  amount={moneyLeft}
                  currency="TWD"
                  size="2xl"
                  className={`mt-[var(--sp-1)] block font-semibold ${
                    moneyLeft < 0 ? "[--text:var(--neg)]" : ""
                  }`}
                />
                <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  your cash, plus income and minus spending since you last
                  updated it
                  {moneyLeftFxNote && ` · ${moneyLeftFxNote}`}
                </p>
              </>
            ) : moneyLeftMixedCurrency ? (
              <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
                Cash and transactions are in different currencies right now,
                so we&apos;re not combining them into one number (mixed
                currencies).
              </p>
            ) : (
              <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
                We can&apos;t work out your running balance right now.
              </p>
            )}
            {confirmedDateLabel && (
              <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
                Balances confirmed {confirmedDateLabel}
              </p>
            )}
          </>
        )}

        {/* Spending group, separated by one hairline. */}
        {mom && (
          <div className="mt-[var(--sp-4)] border-t border-[var(--border)] pt-[var(--sp-4)]">
            <p className="text-[length:var(--t-sm)] text-[var(--text-muted)]">
              Spending — {formatMonth(mom.current.start)}
            </p>
            {mixedCurrency ? (
              <>
                <span className="tnum font-mono mt-[var(--sp-1)] block text-[length:var(--t-xl)] font-semibold text-[var(--text)]">
                  {mom.current.total.toFixed(2)}
                </span>
                <p className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  (mixed currencies)
                </p>
              </>
            ) : (
              <Money
                amount={mom.current.total}
                currency={totalCurrency ?? SPENDING_CURRENCY}
                size="xl"
                className="mt-[var(--sp-1)] block font-semibold"
              />
            )}

            <p className="mt-[var(--sp-2)] text-[length:var(--t-sm)] text-[var(--text-muted)]">
              {deltaPct === null ? (
                "No prior month to compare."
              ) : (
                <>
                  <Money
                    amount={Math.abs(deltaTotal)}
                    currency={SPENDING_CURRENCY}
                    size="sm"
                    className={
                      deltaTotal > 0
                        ? "[--text:var(--neg)]"
                        : deltaTotal < 0
                          ? "[--text:var(--pos)]"
                          : undefined
                    }
                  />{" "}
                  {deltaTotal > 0 ? "↑" : deltaTotal < 0 ? "↓" : "·"} vs{" "}
                  {formatMonth(mom.previous.start)} ({deltaPct >= 0 ? "+" : "−"}
                  {Math.abs(deltaPct).toFixed(0)}%)
                </>
              )}
            </p>

            {mom.byCategory.length === 0 ? (
              <p className="py-[var(--sp-6)] text-center text-[length:var(--t-sm)] text-[var(--text-muted)]">
                No transactions this month.
              </p>
            ) : (
              <CategoryDisclosure byCategory={mom.byCategory} />
            )}
          </div>
        )}

        {/* Actions, separated by one hairline. */}
        <div className="mt-[var(--sp-4)] flex gap-[var(--sp-3)] border-t border-[var(--border)] pt-[var(--sp-4)]">
          <Link href="/cash" className={`flex-1 ${MANAGE_LINK_CLASS}`}>
            Manage cash
          </Link>
          {mom && (
            <Link href="/transactions" className={`flex-1 ${MANAGE_LINK_CLASS}`}>
              Manage spending
            </Link>
          )}
        </div>
      </Card>
    </main>
  );
}
