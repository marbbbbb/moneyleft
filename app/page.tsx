import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeNetWorth, type NetWorth } from "@/lib/calculations/networth";
import {
  getNetWorthHistory,
  recordNetWorthSnapshot,
  type SnapshotPoint,
} from "@/lib/calculations/snapshots";
import { NetWorthView } from "./net-worth-view";
import { RemindersNavLink } from "./reminders-nav-link";

// Live prices feed net worth — don't prerender (the provider layer caches quotes).
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  // First login: send new users through the onboarding quiz before anything else.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_completed_at")
    .maybeSingle();
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  let netWorth: NetWorth | null = null;
  let loadError: string | null = null;
  try {
    netWorth = await computeNetWorth(supabase);
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Could not load net worth.";
  }

  // Trend history — best-effort. This table only records forward from when it
  // was created, so a failure here (e.g. migration not yet run) shouldn't break
  // the rest of the page; the trend section just won't render.
  let history: SnapshotPoint[] = [];
  if (netWorth) {
    try {
      await recordNetWorthSnapshot(supabase, netWorth);
      history = await getNetWorthHistory(supabase);
    } catch {
      history = [];
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Net Worth</h1>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/cash" className="underline">
            Cash
          </Link>
          <Link href="/assets" className="underline">
            Assets
          </Link>
          <Link href="/liabilities" className="underline">
            Liabilities
          </Link>
          <Link href="/holdings" className="underline">
            Holdings
          </Link>
          <Link href="/portfolio" className="underline">
            Portfolio
          </Link>
          <Link href="/transactions" className="underline">
            Transactions
          </Link>
          <RemindersNavLink className="underline" />
          <Link href="/settings" className="underline">
            Settings
          </Link>
        </nav>
      </header>

      {loadError && (
        <p className="text-sm text-red-600">
          {loadError}
          <br />
          <span className="text-gray-500">
            If this mentions a missing table/column, run{" "}
            <code>supabase/002_networth_schema.sql</code>.
          </span>
        </p>
      )}

      {netWorth && <NetWorthView netWorth={netWorth} history={history} />}
    </main>
  );
}
