import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addCashAccount, deleteCashAccount } from "./actions";
import { CashForm } from "./cash-form";

type CashAccount = {
  id: string;
  name: string;
  account_type: string;
  balance: number;
  currency: string;
};

export default async function CashPage() {
  const supabase = await createClient();

  // RLS restricts this to the signed-in user's accounts.
  const { data, error } = await supabase
    .from("cash_accounts")
    .select("id, name, account_type, balance, currency")
    .order("created_at", { ascending: false });

  const accounts = (data ?? []) as CashAccount[];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Cash accounts</h1>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-medium">Add an account</h2>
        <CashForm action={addCashAccount} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Your accounts ({accounts.length})
        </h2>

        {error && (
          <p className="text-sm text-red-600">
            Couldn&apos;t load accounts: {error.message}
          </p>
        )}

        {!error && accounts.length === 0 && (
          <p className="text-sm text-gray-500">
            No cash accounts yet — add one above.
          </p>
        )}

        <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-3">
              <div className="flex flex-col">
                <span className="font-medium">{a.name}</span>
                <span className="text-sm text-gray-500">{a.account_type}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-medium">
                  {a.balance.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {a.currency}
                </span>
                <Link
                  href={`/cash/${a.id}/edit`}
                  className="min-h-11 px-1 text-sm text-gray-500 hover:underline"
                >
                  Edit
                </Link>
                <form action={deleteCashAccount}>
                  <input type="hidden" name="id" value={a.id} />
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
