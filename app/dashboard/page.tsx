import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/login/actions";
import { getMonthOverMonth, type MonthOverMonth } from "@/lib/calculations/spending";
import { loadRulesDefaults } from "@/app/settings/defaults";
import { getPriceProvider } from "@/lib/prices";
import { Card, PageHeader, Button, Money } from "@/components/ui";

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

// The savings-target amount has no currency column of its own (user_rules
// doesn't carry one) — treated as TWD, matching every other currency-less
// figure in this app. Converts a same-single-currency amount into TWD via the
// same live FX provider the net-worth page uses, WITHOUT pulling in its full
// computeNetWorth pipeline (portfolio prices, assets, liabilities) just for one
// rate lookup.
async function convertToTWD(
  amount: number,
  currency: string,
): Promise<{ value: number | null; rate: number | null }> {
  if (currency === "TWD") return { value: amount, rate: null };
  const rate = await getPriceProvider().getFxRate(currency, "TWD");
  return { value: rate != null ? amount * rate : null, rate };
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Middleware already guards this route, but we read the user for display.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Monthly savings target — reuses the same loader /settings and /onboarding
  // already use, rather than re-querying user_rules here. savingsTargetCurrency
  // is the specific user_rules row's OWN stored currency (not the user's
  // current preferred_currency, which could have changed since), so we no
  // longer have to assume it's TWD.
  const { defaults: prefs, savingsTargetCurrency } = await loadRulesDefaults();
  const savingsTargetNum = prefs.savingsTarget ? Number(prefs.savingsTarget) : 0;
  const savingsTarget = Number.isFinite(savingsTargetNum) ? savingsTargetNum : 0;

  // Safe to spend = cash − this month's spending − savings target, all
  // resolved into TWD. Only computed when cash and spending are each a single
  // currency — otherwise subtracting would silently mix currencies, which we
  // don't do anywhere else in this app either. Any side that isn't already
  // TWD (including the savings target now) is converted via the live FX rate
  // (see convertToTWD) rather than assumed — a single cheap lookup per side,
  // not the full net-worth pipeline.
  let safeToSpend: number | null = null;
  let safeToSpendFxNote: string | null = null;

  if (mom && cash.length > 0 && cashCurrency && !cashMixed && !mixedCurrency) {
    const spendCurrency = totalCurrency ?? SPENDING_CURRENCY;
    // A zero target has no currency to get wrong; only resolve a real one
    // when there's an actual amount to convert. Null currency only happens
    // when no savings-target rule exists yet.
    const targetCurrency =
      savingsTarget > 0 ? (savingsTargetCurrency ?? spendCurrency) : "TWD";

    const cashConv = await convertToTWD(cashTotal, cashCurrency);
    const spendConv = await convertToTWD(mom.current.total, spendCurrency);
    const targetConv = await convertToTWD(savingsTarget, targetCurrency);

    if (cashConv.value != null && spendConv.value != null && targetConv.value != null) {
      safeToSpend = cashConv.value - spendConv.value - targetConv.value;
      const seen = new Set<string>();
      const rateNotes: string[] = [];
      for (const [curr, conv] of [
        [cashCurrency, cashConv],
        [spendCurrency, spendConv],
        [targetCurrency, targetConv],
      ] as [string, { rate: number | null }][]) {
        if (conv.rate != null && !seen.has(curr)) {
          rateNotes.push(`1 ${curr} = ${conv.rate} TWD`);
          seen.add(curr);
        }
      }
      if (rateNotes.length > 0) safeToSpendFxNote = `Converted at ${rateNotes.join(", ")}.`;
    }
  }

  // True only when we genuinely tried and couldn't (mixed currencies, or an
  // FX lookup failed) — not when there's simply no spending data (mom is
  // null) or no cash accounts yet (that's the empty state instead).
  const safeToSpendUnavailable = Boolean(mom) && cash.length > 0 && safeToSpend === null;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-[var(--sp-6)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <div>
        <PageHeader
          title="Dashboard"
          nav={
            <form action={signout}>
              <Button type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          }
        />
        <p className="text-[length:var(--t-sm)] text-[var(--text-subtle)]">
          Signed in as {user?.email}
        </p>
      </div>

      <Card>
        <p className="text-[length:var(--t-sm)] text-[var(--text-muted)]">Cash</p>

        {cash.length === 0 ? (
          <>
            <p className="mt-[var(--sp-2)] text-[length:var(--t-sm)] text-[var(--text-muted)]">
              No cash accounts yet — add one to see what&apos;s safe to spend.
            </p>
            <Link href="/cash" className={`mt-[var(--sp-3)] ${MANAGE_LINK_CLASS}`}>
              Manage cash
            </Link>
          </>
        ) : (
          <>
            {cashMixed ? (
              <>
                <span className="tnum mt-[var(--sp-1)] block text-[length:var(--t-2xl)] font-semibold text-[var(--text)]">
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
                size="2xl"
                className="mt-[var(--sp-1)] block font-semibold"
              />
            )}

            <div className="mt-[var(--sp-4)] border-t border-[var(--border)] pt-[var(--sp-4)]">
              <p className="text-[length:var(--t-sm)] text-[var(--text-muted)]">
                Safe to spend
              </p>
              {safeToSpend !== null ? (
                <>
                  <Money
                    amount={safeToSpend}
                    currency="TWD"
                    size="lg"
                    className={`mt-[var(--sp-1)] block font-semibold ${
                      safeToSpend < 0
                        ? "[--text:var(--neg)]"
                        : safeToSpend > 0
                          ? "[--text:var(--pos)]"
                          : ""
                    }`}
                  />
                  <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
                    cash, minus this month&apos;s spending
                    {savingsTarget > 0 &&
                      ` and your ${savingsTargetCurrency ?? "TWD"} ${savingsTarget.toLocaleString("en-US")} savings goal`}
                    {safeToSpendFxNote && ` · ${safeToSpendFxNote}`}
                  </p>
                </>
              ) : safeToSpendUnavailable ? (
                <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  Cash and spending are in different currencies right now, so
                  we&apos;re not combining them into one number (mixed currencies).
                </p>
              ) : (
                <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  Add a transaction this month to see what&apos;s safe to spend.
                </p>
              )}
            </div>

            <Link href="/cash" className={`mt-[var(--sp-4)] ${MANAGE_LINK_CLASS}`}>
              Manage cash
            </Link>
          </>
        )}
      </Card>

      {mom && (
        <Card>
          <p className="text-[length:var(--t-sm)] text-[var(--text-muted)]">
            Spending — {formatMonth(mom.current.start)}
          </p>
          {mixedCurrency ? (
            <>
              <span className="tnum mt-[var(--sp-1)] block text-[length:var(--t-2xl)] font-semibold text-[var(--text)]">
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
              size="2xl"
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
            <ul className="mt-[var(--sp-4)] flex flex-col divide-y divide-[var(--border)]">
              {mom.byCategory.slice(0, 5).map((c) => (
                <li
                  key={c.category}
                  className="flex items-center justify-between py-[var(--sp-2)] text-[length:var(--t-sm)]"
                >
                  <span className="text-[var(--text)]">{c.category}</span>
                  <span className="flex items-center gap-[var(--sp-3)]">
                    <Money amount={c.current} currency={SPENDING_CURRENCY} size="sm" />
                    <Money
                      amount={-c.delta}
                      currency={SPENDING_CURRENCY}
                      signed
                      size="sm"
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Link href="/transactions" className={`mt-[var(--sp-4)] ${MANAGE_LINK_CLASS}`}>
            Manage spending
          </Link>
        </Card>
      )}
    </main>
  );
}
