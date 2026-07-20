import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/login/actions";
import { getMonthOverMonth, type MonthOverMonth } from "@/lib/calculations/spending";

function formatMonth(startYmd: string): string {
  const [y, m] = startYmd.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;
}

// Probes a table by asking for an exact row count scoped to the current user.
// RLS guarantees the count only reflects rows this user owns.
async function checkTable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "transactions" | "holdings",
) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    return { ok: false, detail: error.message };
  }
  return { ok: true, detail: `${count ?? 0} row(s) visible to you` };
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Middleware already guards this route, but we read the user for display.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [transactions, holdings] = await Promise.all([
    checkTable(supabase, "transactions"),
    checkTable(supabase, "holdings"),
  ]);

  const rows = [
    { name: "transactions", ...transactions },
    { name: "holdings", ...holdings },
  ];

  // Spending calculations layer — degrade gracefully if the table isn't ready.
  let mom: MonthOverMonth | null = null;
  try {
    mom = await getMonthOverMonth(supabase);
  } catch {
    mom = null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-500">Signed in as {user?.email}</p>
        </div>
        <form action={signout}>
          <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700">
            Sign out
          </button>
        </form>
      </header>

      <nav className="flex flex-wrap gap-3">
        <Link
          href="/transactions"
          className="rounded-md border border-gray-300 min-h-11 px-4 py-2 text-sm font-medium dark:border-gray-700"
        >
          Transactions →
        </Link>
        <Link
          href="/holdings"
          className="rounded-md border border-gray-300 min-h-11 px-4 py-2 text-sm font-medium dark:border-gray-700"
        >
          Holdings →
        </Link>
        <Link
          href="/portfolio"
          className="rounded-md border border-gray-300 min-h-11 px-4 py-2 text-sm font-medium dark:border-gray-700"
        >
          Portfolio →
        </Link>
        <Link
          href="/cash"
          className="rounded-md border border-gray-300 min-h-11 px-4 py-2 text-sm font-medium dark:border-gray-700"
        >
          Cash →
        </Link>
        <Link
          href="/"
          className="rounded-md border border-gray-300 min-h-11 px-4 py-2 text-sm font-medium dark:border-gray-700"
        >
          Net worth →
        </Link>
      </nav>

      {mom && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-medium">
              Spending — {formatMonth(mom.current.start)}
            </h2>
            <span className="text-2xl font-semibold">
              {mom.current.total.toFixed(2)}
            </span>
          </div>

          <p className="mb-4 text-sm text-gray-500">
            {mom.deltaPct === null
              ? "No spending last month to compare against."
              : `${signed(mom.deltaTotal)} vs ${formatMonth(mom.previous.start)} (${mom.deltaPct >= 0 ? "+" : "−"}${Math.abs(mom.deltaPct).toFixed(0)}%)`}
          </p>

          {mom.byCategory.length === 0 ? (
            <p className="text-sm text-gray-500">No transactions this month.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
              {mom.byCategory.slice(0, 5).map((c) => (
                <li
                  key={c.category}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span>{c.category}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">{c.current.toFixed(2)}</span>
                    <span
                      className={
                        c.delta > 0
                          ? "text-red-600"
                          : c.delta < 0
                            ? "text-green-600"
                            : "text-gray-400"
                      }
                    >
                      {signed(c.delta)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Database connection</h2>
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 dark:border-gray-800"
            >
              <span className="font-mono text-sm">{row.name}</span>
              <span
                className={`text-sm ${row.ok ? "text-green-600" : "text-red-600"}`}
              >
                {row.ok ? `✓ connected — ${row.detail}` : `✗ ${row.detail}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-gray-500">
          Both tables are protected by Row Level Security, so these counts only
          ever include rows owned by the signed-in account.
        </p>
      </section>
    </main>
  );
}
