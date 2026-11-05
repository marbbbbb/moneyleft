import { createClient } from "@/lib/supabase/server";
import { liabilityTypeLabel } from "@/lib/liabilities";
import { addLiability, deleteLiability } from "./actions";
import { LiabilityForm } from "./liability-form";
import { amortizationProgress, currentBalance } from "@/lib/amortization";
import { Money, PageHeader, TextButton } from "@/components/ui";

type Liability = {
  id: string;
  name: string;
  liability_type: string;
  balance: number;
  currency: string;
  interest_rate: number | null;
  kind: string;
  original_principal: number | null;
  term_months: number | null;
  start_date: string | null;
  monthly_payment: number | null;
  anchor_balance: number | null;
  anchor_date: string | null;
};

function money(n: number, currency: string): string {
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export default async function LiabilitiesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("liabilities")
    .select(
      "id, name, liability_type, balance, currency, interest_rate, kind, original_principal, term_months, start_date, monthly_payment, anchor_balance, anchor_date",
    )
    .order("created_at", { ascending: false });

  const liabilities = (data ?? []) as Liability[];
  const asOf = new Date();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <PageHeader title="Liabilities" />

      <section>
        <h2 className="mb-3 text-lg font-medium">Add a debt</h2>
        <LiabilityForm action={addLiability} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Your debts ({liabilities.length})
        </h2>

        {error && (
          <p className="text-sm text-[var(--neg)]">
            Couldn&apos;t load liabilities: {error.message}
          </p>
        )}

        {!error && liabilities.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">
            No debts yet — add one above.
          </p>
        )}

        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {liabilities.map((l) => {
            // A no-op for kind='simple' (returns l.balance unchanged) — always
            // routing through here means there's exactly one balance display
            // path for both kinds, not a duplicated simple/amortizing branch.
            const displayBalance = currentBalance(l, asOf);
            const progress = amortizationProgress(l, asOf);

            return (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{l.name}</span>
                  {progress ? (
                    <span className="text-sm text-[var(--text-muted)]">
                      Orig {money(l.original_principal ?? 0, l.currency)} ·{" "}
                      {progress.monthsElapsed} of {progress.termMonths} payments
                      made ·{" "}
                      {Math.max(
                        0,
                        Math.round((progress.termMonths - progress.monthsElapsed) / 12),
                      )}{" "}
                      years left
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">
                      {liabilityTypeLabel(l.liability_type)}
                      {l.interest_rate != null && ` · ${l.interest_rate}%`}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Money
                    amount={-displayBalance}
                    currency={l.currency}
                    signed
                    className="font-medium"
                  />
                  <TextButton href={`/liabilities/${l.id}/edit`}>Edit</TextButton>
                  <form action={deleteLiability}>
                    <input type="hidden" name="id" value={l.id} />
                    <TextButton tone="danger">Delete</TextButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
