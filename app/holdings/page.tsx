import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addHolding, deleteHolding } from "./actions";
import { HoldingForm } from "./holding-form";

type Holding = {
  id: string;
  ticker: string;
  shares: number;
  cost_basis: number;
  date_bought: string;
  currency: string;
};

export default async function HoldingsPage() {
  const supabase = await createClient();

  // RLS restricts this to the signed-in user's rows. Newest purchase first.
  const { data, error } = await supabase
    .from("holdings")
    .select("id, ticker, shares, cost_basis, date_bought, currency")
    .order("date_bought", { ascending: false })
    .order("created_at", { ascending: false });

  const holdings = (data ?? []) as Holding[];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Holdings</h1>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-medium">Add a holding</h2>
        <HoldingForm action={addHolding} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Your holdings ({holdings.length})
        </h2>

        {error && (
          <p className="text-sm text-red-600">
            Couldn&apos;t load holdings: {error.message}
          </p>
        )}

        {!error && holdings.length === 0 && (
          <p className="text-sm text-gray-500">
            No holdings yet — add one above.
          </p>
        )}

        <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
          {holdings.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-3">
              <div className="flex flex-col">
                <span className="font-medium">
                  {h.ticker} · {h.shares} @ {h.cost_basis.toFixed(2)}{" "}
                  {h.currency}
                </span>
                <span className="text-sm text-gray-500">
                  bought {h.date_bought}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/holdings/${h.id}/edit`}
                  className="min-h-11 px-1 text-sm text-gray-500 hover:underline"
                >
                  Edit
                </Link>
                <form action={deleteHolding}>
                  <input type="hidden" name="id" value={h.id} />
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
