import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  addTransaction,
  cancelRecurring,
  deleteTransaction,
  materializeRecurring,
} from "./actions";
import { TransactionForm } from "./transaction-form";

export const dynamic = "force-dynamic";

type Transaction = {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string | null;
  type: "income" | "expense";
};

type Recurring = {
  id: string;
  amount: number;
  category: string;
  type: "income" | "expense";
  frequency: string;
  next_run: string;
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
      .select("id, date, amount, category, note, type")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("recurring_transactions")
      .select("id, amount, category, type, frequency, next_run")
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/dashboard" className="underline">
            Dashboard
          </Link>
          <Link href="/holdings" className="underline">
            Holdings
          </Link>
        </nav>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-medium">Add a transaction</h2>
        <TransactionForm action={addTransaction} categories={categories} />
      </section>

      {recurring.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium">
            Recurring ({recurring.length})
          </h2>
          <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
            {recurring.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {r.category} · {r.type === "income" ? "+" : "−"}
                    {r.amount.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {r.frequency} · next {r.next_run}
                  </span>
                </div>
                <form action={cancelRecurring}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="min-h-11 shrink-0 px-1 text-sm text-red-600 hover:underline">
                    Cancel
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Your transactions ({transactions.length})
        </h2>

        {error && (
          <p className="text-sm text-red-600">
            Couldn&apos;t load transactions: {error.message}
          </p>
        )}

        {!error && transactions.length === 0 && (
          <p className="text-sm text-gray-500">No transactions yet.</p>
        )}

        <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
          {transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{t.category}</span>
                <span className="text-sm text-gray-500">
                  {t.date}
                  {t.note ? ` — ${t.note}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`font-medium ${
                    t.type === "income" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {t.type === "income" ? "+" : "−"}
                  {t.amount.toFixed(2)}
                </span>
                <Link
                  href={`/transactions/${t.id}/edit`}
                  className="min-h-11 px-1 text-sm text-gray-500 hover:underline"
                >
                  Edit
                </Link>
                <form action={deleteTransaction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="min-h-11 px-1 text-sm text-red-600 hover:underline">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
