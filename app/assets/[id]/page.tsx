import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  assetCategoryLabel,
  changeColorClass,
  changeVsPurchase,
  confidenceClass,
  formatAssetMoney,
  formatRange,
  formatSignedMoney,
  isAiSource,
  sourceBadgeClass,
  valuationSourceLabel,
} from "@/lib/assets";
import { deletePhoto } from "../actions";
import { EstimateButton } from "./estimate-button";
import { PhotoUploader } from "./photo-uploader";
import { ValuationForm } from "./valuation-form";
import { ValueChart } from "./value-chart";

type SourceLink = { url: string; title: string };

type Valuation = {
  id: string;
  value_low: number;
  value_high: number;
  currency: string;
  confidence: string;
  source: string;
  rationale: string | null;
  sources: SourceLink[] | null;
  valued_at: string;
};

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: asset } = await supabase
    .from("assets")
    .select("id, name, category, description, currency, acquisition_cost, acquisition_date")
    .eq("id", id)
    .maybeSingle();

  if (!asset) notFound();

  const [{ data: valuationRows }, { data: photoRows }] = await Promise.all([
    supabase
      .from("asset_valuations")
      .select(
        "id, value_low, value_high, currency, confidence, source, rationale, sources, valued_at",
      )
      .eq("asset_id", id)
      // Newest first. created_at/id break ties so "latest" is deterministic.
      .order("valued_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("asset_photos")
      .select("id, storage_path, caption")
      .eq("asset_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const valuations = (valuationRows ?? []) as Valuation[];
  const current = valuations[0]; // ordered newest first
  // Change from the fixed purchase price to the latest valuation.
  const purchasePrice =
    asset.acquisition_cost != null ? Number(asset.acquisition_cost) : null;
  const change =
    purchasePrice != null && current
      ? changeVsPurchase(purchasePrice, current)
      : null;

  // The bucket is private, so generate short-lived signed URLs for display.
  const photos = await Promise.all(
    (photoRows ?? []).map(async (p) => {
      const { data } = await supabase.storage
        .from("asset-photos")
        .createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{asset.name}</h1>
          <p className="text-sm text-gray-500">
            {assetCategoryLabel(asset.category)}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={`/assets/${asset.id}/edit`} className="underline">
            Edit
          </Link>
        </nav>
      </header>

      {/* Current value */}
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-800">
        <p className="text-sm text-gray-500">Current value</p>
        {current ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold">
              {formatRange(current.value_low, current.value_high, current.currency)}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs ${confidenceClass(current.confidence)}`}
            >
              {current.confidence} confidence
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs ${sourceBadgeClass(current.source)}`}
            >
              {valuationSourceLabel(current.source, asset.category)}
            </span>
          </div>
        ) : (
          <p className="mt-1 text-gray-400">No valuation yet.</p>
        )}
        {purchasePrice !== null && (
          <p className="mt-2 text-sm text-gray-500">
            Purchase price {formatAssetMoney(purchasePrice, asset.currency)}
            {asset.acquisition_date &&
              ` on ${new Date(asset.acquisition_date).toLocaleDateString()}`}
          </p>
        )}
        {change && (
          <p className={`mt-1 text-sm ${changeColorClass(change.absolute)}`}>
            {formatSignedMoney(change.absolute, asset.currency)}
            {change.pct !== null &&
              ` (${change.pct >= 0 ? "+" : "−"}${Math.abs(change.pct).toFixed(1)}%)`}{" "}
            <span className="text-gray-500">since purchase</span>
          </p>
        )}
        {asset.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
            {asset.description}
          </p>
        )}

        {/* Reasoning + sources from the latest valuation (AI/market estimate). */}
        {current?.rationale && (
          <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-900">
            <p className="mb-1 font-medium text-gray-700 dark:text-gray-200">
              How this was estimated
            </p>
            <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">
              {current.rationale}
            </p>
            {current.sources && current.sources.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-500">Sources</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {current.sources.map((s, i) => (
                    <li key={i} className="truncate text-xs">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {s.title || s.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {current && isAiSource(current.source) && (
          <p className="mt-2 text-xs text-gray-500">
            ⚠️ AI estimate only — not financial advice. Get a professional
            appraisal before relying on this value.
          </p>
        )}

        <div className="mt-4">
          <EstimateButton assetId={asset.id} />
        </div>
      </section>

      {/* Photos */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Photos</h2>
        {photos.length === 0 ? (
          <p className="mb-3 text-sm text-gray-500">No photos yet.</p>
        ) : (
          <ul className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="flex flex-col gap-1">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt={p.caption ?? "Asset photo"}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-md bg-gray-200 dark:bg-gray-800" />
                )}
                <form action={deletePhoto}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="storage_path" value={p.storage_path} />
                  <input type="hidden" name="asset_id" value={asset.id} />
                  <button className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {user && <PhotoUploader userId={user.id} assetId={asset.id} />}
      </section>

      {/* Add a valuation */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Update value</h2>
        <ValuationForm assetId={asset.id} defaultCurrency={asset.currency} />
      </section>

      {/* Valuation history */}
      <section>
        <h2 className="mb-3 text-lg font-medium">
          Valuation history ({valuations.length})
        </h2>
        <ValueChart valuations={valuations} />
        <ul className="mt-3 flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
          {valuations.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-2 text-sm">
              <span>{formatRange(v.value_low, v.value_high, v.currency)}</span>
              <span className="flex items-center gap-2 text-gray-500">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${confidenceClass(v.confidence)}`}
                >
                  {v.confidence}
                </span>
                <span>{valuationSourceLabel(v.source, asset.category)}</span>
                <span>{new Date(v.valued_at).toLocaleDateString()}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
