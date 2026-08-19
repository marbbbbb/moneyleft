import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMonthOverMonth, type MonthOverMonth } from "@/lib/calculations/spending";
import { computeRunningCash, type RunningCash } from "@/lib/calculations/networth";
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

  // Money left = the same running balance (cash + income − expenses since
  // cash_confirmed_at, resolved into TWD) that now feeds the net worth
  // page's Cash & Investments too — see computeRunningCash, the one shared
  // implementation. Only TWD is requested since that's the only currency
  // this card ever displays. Degrade gracefully if the call fails outright
  // (e.g. a genuine cash_accounts fetch error) rather than crashing the page.
  let running: RunningCash | null = null;
  try {
    running = await computeRunningCash(supabase, ["TWD"]);
  } catch {
    running = null;
  }
  // null (rather than the cash-only fallback computeRunningCash returns
  // when confirmedAt is unavailable) specifically when there's no confirmed
  // date to show the figure against — matches this card's own "unavailable"
  // messaging, unchanged from before this refactor.
  const moneyLeft = running?.confirmedAt ? running.values["TWD"] : null;
  const moneyLeftFxNote =
    running?.confirmedAt && running.rateNotes["TWD"]?.length
      ? `Converted at ${running.rateNotes["TWD"].join(", ")}.`
      : null;
  const confirmedDateLabel = running?.confirmedAt
    ? new Date(running.confirmedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

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
