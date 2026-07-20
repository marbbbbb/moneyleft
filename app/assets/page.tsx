import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  assetCategoryLabel,
  changeColorClass,
  changeVsPurchase,
  confidenceClass,
  formatRange,
  latestValuation,
} from "@/lib/assets";
import { deleteAsset } from "./actions";
import { AssetForm } from "./asset-form";

type Asset = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  currency: string;
  acquisition_cost: number | null;
};

type ValuationRow = {
  asset_id: string;
  value_low: number;
  value_high: number;
  currency: string;
  confidence: string;
  valued_at: string;
  created_at: string;
};

export default async function AssetsPage() {
  const supabase = await createClient();

  const [{ data: assetRows, error }, { data: valuationRows }] =
    await Promise.all([
      supabase
        .from("assets")
        .select("id, name, category, description, currency, acquisition_cost")
        .order("created_at", { ascending: false }),
      // Full time series so we can show the latest value and change vs purchase.
      supabase
        .from("asset_valuations")
        .select(
          "asset_id, value_low, value_high, currency, confidence, valued_at, created_at",
        ),
    ]);

  const assets = (assetRows ?? []) as Asset[];

  // Group valuations by asset, newest first (so [0] is the latest).
  const byAsset = new Map<string, ValuationRow[]>();
  for (const v of (valuationRows ?? []) as ValuationRow[]) {
    const list = byAsset.get(v.asset_id) ?? [];
    list.push(v);
    byAsset.set(v.asset_id, list);
  }
  for (const list of byAsset.values()) {
    list.sort(
      (a, b) =>
        new Date(b.valued_at).getTime() - new Date(a.valued_at).getTime(),
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Asset vault</h1>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/" className="underline">
            Net worth
          </Link>
          <Link href="/cash" className="underline">
            Cash
          </Link>
        </nav>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-medium">Add an asset</h2>
        <AssetForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Your assets ({assets.length})</h2>

        {error && (
          <p className="text-sm text-red-600">
            Couldn&apos;t load assets: {error.message}
          </p>
        )}

        {!error && assets.length === 0 && (
          <p className="text-sm text-gray-500">
            No assets yet. Add one above and it flows into illiquid net worth.
          </p>
        )}

        <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
          {assets.map((a) => {
            const points = byAsset.get(a.id) ?? [];
            const latest = latestValuation(points);
            const change =
              a.acquisition_cost != null && latest
                ? changeVsPurchase(a.acquisition_cost, latest)
                : null;
            return (
              <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex flex-col gap-1">
                  <Link href={`/assets/${a.id}`} className="font-medium hover:underline">
                    {a.name}
                  </Link>
                  <span className="text-sm text-gray-500">
                    {assetCategoryLabel(a.category)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end gap-1">
                    {latest ? (
                      <>
                        <span className="font-medium">
                          {formatRange(
                            latest.value_low,
                            latest.value_high,
                            latest.currency,
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          {change && change.absolute !== 0 && (
                            <span
                              className={`text-xs ${changeColorClass(change.absolute)}`}
                              title="Change vs purchase price"
                            >
                              {change.pct !== null
                                ? `${change.pct >= 0 ? "▲ +" : "▼ −"}${Math.abs(change.pct).toFixed(1)}%`
                                : change.absolute >= 0
                                  ? "▲"
                                  : "▼"}
                            </span>
                          )}
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs ${confidenceClass(latest.confidence)}`}
                          >
                            {latest.confidence}
                          </span>
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">no valuation</span>
                    )}
                  </div>
                  <form action={deleteAsset}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-sm text-red-600 hover:underline">
                      Delete
                    </button>
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
