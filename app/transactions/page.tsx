import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  addTransaction,
  cancelRecurring,
  deleteTransaction,
  materializeRecurring,
} from "./actions";
import { TransactionForm } from "./transaction-form";
import { Card, PageHeader, Button, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

type Transaction = {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string | null;
  type: "income" | "expense";
  currency: string;
};

type Recurring = {
  id: string;
  amount: number;
  category: string;
  type: "income" | "expense";
  frequency: string;
  next_run: string;
  currency: string;
};

export default async function TransactionsPage() {
  const supabase = await createClient();

  // Create any recurring occurrences that are now due before reading the list.
  try {
    await materializeRecurring();
  } catch {
    // Non-fatal — the page still renders existing transactions.
  }

  const [{ data, error }, { data: recurringRows }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, date, amount, category, note, type, currency")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("recurring_transactions")
      .select("id, amount, category, type, frequency, next_run, currency")
      .eq("is_active", true)
      .order("next_run", { ascending: true }),
  ]);

  const transactions = (data ?? []) as Transaction[];
  const recurring = (recurringRows ?? []) as Recurring[];

  // Distinct categories for autocomplete + fuzzy matching.
  const categories = [
    ...new Map(
      transactions
        .map((t) => t.category?.trim())
        .filter(Boolean)
        .map((c) => [c.toLowerCase(), c]),
    ).values(),
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-[var(--sp-6)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <PageHeader title="Transactions" />

      <Card>
        <h2 className="mb-[var(--sp-3)] text-[length:var(--t-base)] font-medium text-[var(--text)]">
          Add a transaction
        </h2>
        <TransactionForm action={addTransaction} categories={categories} />
      </Card>

      {recurring.length > 0 && (
        <section>
          <h2 className="mb-[var(--sp-2)] text-[length:var(--t-sm)] text-[var(--text-muted)]">
            Recurring ({recurring.length})
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {recurring.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-[var(--sp-3)] py-[var(--sp-3)]"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[length:var(--t-base)] text-[var(--text)]">
                    {r.category}
                  </span>
                  <span className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
                    {r.frequency} · next {r.next_run}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-[var(--sp-3)]">
                  <Money
                    amount={r.amount}
                    currency={r.currency}
                    size="sm"
                    className={r.type === "income" ? "[--text:var(--pos)]" : undefined}
                  />
                  <form action={cancelRecurring}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" variant="danger">
                      Cancel
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-[var(--sp-2)] text-[length:var(--t-sm)] text-[var(--text-muted)]">
          Your transactions ({transactions.length})
        </h2>

        {error && (
          <p className="text-[length:var(--t-sm)] text-[var(--neg)]">
            Couldn&apos;t load transactions: {error.message}
          </p>
        )}

        {!error && transactions.length === 0 && (
          <p className="py-[var(--sp-6)] text-center text-[length:var(--t-sm)] text-[var(--text-muted)]">
            No transactions yet.
          </p>
        )}

        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {transactions.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-[var(--sp-3)] py-[var(--sp-3)]"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[length:var(--t-base)] text-[var(--text)]">
                  {t.category}
                </span>
                <span className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  {t.date}
                  {t.note ? ` · ${t.note}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-[var(--sp-3)]">
                <Money
                  amount={t.amount}
                  currency={t.currency}
                  className={t.type === "income" ? "[--text:var(--pos)]" : undefined}
                />
                <Link
                  href={`/transactions/${t.id}/edit`}
                  className="text-[length:var(--t-xs)] text-[var(--text-muted)]"
                >
                  Edit
                </Link>
                <form action={deleteTransaction}>
                  <input type="hidden" name="id" value={t.id} />
                  <Button type="submit" variant="danger">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
