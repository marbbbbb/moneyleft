"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ASSET_CATEGORY_VALUES, CONFIDENCE_LEVELS } from "@/lib/assets";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import { estimateAssetValue, usesAiValuation } from "@/lib/valuation/engine";

type ActionState = { error?: string };

// Edits an asset's descriptive fields, purchase price/date, and category-specific
// details. Does NOT rewrite valuation history — change-tracking reads
// acquisition_cost, so editing the purchase price correctly updates the gain.
export async function updateAsset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing asset." };

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const purchasePrice = Number(formData.get("purchase_price"));
  const purchaseDate = String(formData.get("purchase_date") ?? "");

  if (!name) return { error: "Name is required." };
  if (!ASSET_CATEGORY_VALUES.includes(category as never))
    return { error: "Invalid category." };
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency))
    return { error: "Unsupported currency." };
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0)
    return { error: "Purchase price must be a non-negative number." };
  if (!purchaseDate) return { error: "Purchase date is required." };

  const details: Record<string, unknown> = {};
  if (category === "precious_metal") {
    const metal = String(formData.get("metal") ?? "gold");
    const weight = Number(formData.get("weight_grams"));
    const purity = Number(formData.get("purity"));
    if (!Number.isFinite(weight) || weight <= 0)
      return { error: "Weight (grams) is required for precious metals." };
    if (!Number.isFinite(purity) || purity <= 0 || purity > 1)
      return { error: "Purity must be between 0 and 1 (e.g. 0.999 for 24k)." };
    details.metal = metal;
    details.weight_grams = weight;
    details.purity = purity;
  }
  if (category === "vehicle") {
    const mileage = Number(formData.get("mileage"));
    if (Number.isFinite(mileage) && mileage > 0) details.mileage = mileage;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({
      name,
      category,
      description: description || null,
      currency,
      acquisition_cost: purchasePrice,
      acquisition_date: purchaseDate,
      details,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/assets/${id}`);
  revalidatePath("/assets");
  revalidatePath("/");
  redirect(`/assets/${id}`);
}

export async function addAsset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const purchasePrice = Number(formData.get("purchase_price"));
  const purchaseDate = String(formData.get("purchase_date") ?? "");
  // Current value is optional — blank means "let AI estimate it later".
  const currentValueRaw = String(formData.get("value") ?? "").trim();
  const hasCurrentValue = currentValueRaw !== "";
  const currentValue = hasCurrentValue ? Number(currentValueRaw) : null;

  if (!name) return { error: "Name is required." };
  if (!ASSET_CATEGORY_VALUES.includes(category as never))
    return { error: "Invalid category." };
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency))
    return { error: "Unsupported currency." };
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0)
    return { error: "Purchase price must be a non-negative number." };
  if (!purchaseDate) return { error: "Purchase date is required." };
  if (hasCurrentValue && (!Number.isFinite(currentValue!) || currentValue! < 0))
    return { error: "Current value must be a non-negative number." };

  // Category-specific detail fields the valuation engine needs later.
  const details: Record<string, unknown> = {};
  if (category === "precious_metal") {
    const metal = String(formData.get("metal") ?? "gold");
    const weight = Number(formData.get("weight_grams"));
    const purity = Number(formData.get("purity"));
    if (!Number.isFinite(weight) || weight <= 0)
      return { error: "Weight (grams) is required for precious metals." };
    if (!Number.isFinite(purity) || purity <= 0 || purity > 1)
      return { error: "Purity must be between 0 and 1 (e.g. 0.999 for 24k)." };
    details.metal = metal;
    details.weight_grams = weight;
    details.purity = purity;
  }
  if (category === "vehicle") {
    const mileage = Number(formData.get("mileage"));
    if (Number.isFinite(mileage) && mileage > 0) details.mileage = mileage;
  }

  const supabase = await createClient();

  // Purchase price + date are fixed history on the asset itself.
  const { data: asset, error } = await supabase
    .from("assets")
    .insert({
      name,
      category,
      description: description || null,
      currency,
      acquisition_cost: purchasePrice,
      acquisition_date: purchaseDate,
      details,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // A date-only value is read as midnight UTC, which for a timezone ahead of UTC
  // lands in the FUTURE — and a future-dated row would outrank every later
  // valuation as "latest". Clamp the purchase seed to just before now so any
  // subsequent valuation (current value, AI estimate) is always strictly newer.
  const nowMs = Date.now();
  const purchaseMidnightMs = new Date(`${purchaseDate}T00:00:00Z`).getTime();
  if (Number.isNaN(purchaseMidnightMs))
    return { error: "Invalid purchase date." };
  const purchaseValuedAt = new Date(
    Math.min(purchaseMidnightMs, nowMs - 1000),
  ).toISOString();

  // Seed the time series: the purchase price, dated at the purchase date.
  // Manual values are tight ranges at high confidence.
  const seed = [
    {
      asset_id: asset.id,
      value_low: purchasePrice,
      value_high: purchasePrice,
      currency,
      confidence: "high",
      source: "manual",
      valued_at: purchaseValuedAt,
    },
  ];

  // Add a current-value entry (dated now) only if one was provided, and unless
  // it's identical to the purchase entry (same value bought today).
  const today = new Date().toISOString().slice(0, 10);
  if (
    hasCurrentValue &&
    (currentValue !== purchasePrice || purchaseDate !== today)
  ) {
    seed.push({
      asset_id: asset.id,
      value_low: currentValue!,
      value_high: currentValue!,
      currency,
      confidence: "high",
      source: "manual",
      valued_at: new Date(nowMs).toISOString(),
    });
  }

  const { error: valuationError } = await supabase
    .from("asset_valuations")
    .insert(seed);

  if (valuationError) return { error: valuationError.message };

  revalidatePath("/assets");
  revalidatePath("/"); // illiquid net worth
  return {};
}

export async function deleteAsset(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Cascade removes valuations and photo rows; RLS scopes it to the owner.
  await supabase.from("assets").delete().eq("id", id);

  revalidatePath("/assets");
  revalidatePath("/");
}

export async function addValuation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const assetId = String(formData.get("asset_id") ?? "");
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const confidence = String(formData.get("confidence") ?? "");
  const low = Number(formData.get("value_low"));
  const high = Number(formData.get("value_high"));

  if (!assetId) return { error: "Missing asset." };
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency))
    return { error: "Unsupported currency." };
  if (!(CONFIDENCE_LEVELS as readonly string[]).includes(confidence))
    return { error: "Invalid confidence." };
  if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high < 0)
    return { error: "Values must be non-negative numbers." };
  if (high < low) return { error: "High must be greater than or equal to low." };

  const supabase = await createClient();
  const { error } = await supabase.from("asset_valuations").insert({
    asset_id: assetId,
    value_low: low,
    value_high: high,
    currency,
    confidence,
    source: "manual",
  });

  if (error) return { error: error.message };

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
  revalidatePath("/");
  return {};
}

// Runs the category-routed valuation engine and saves the result as a new dated
// row in the time series. Failures return a clear message instead of throwing.
type EstimateState = {
  error?: string;
  ok?: boolean;
  note?: string;
  limited?: boolean;
};

export async function estimateValuation(
  _prev: EstimateState,
  formData: FormData,
): Promise<EstimateState> {
  const assetId = String(formData.get("asset_id") ?? "");
  if (!assetId) return { error: "Missing asset." };

  const supabase = await createClient();
  const { data: asset, error } = await supabase
    .from("assets")
    .select(
      "name, category, description, currency, acquisition_cost, acquisition_date, details",
    )
    .eq("id", assetId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!asset) return { error: "Asset not found." };

  // Spend a daily credit BEFORE calling the paid API, so hitting the limit costs
  // nothing. Enforced in the DB (security-definer function) — the browser can't
  // reset or raise it. Only AI-backed categories are limited; gold and vehicle
  // estimates use free data sources.
  if (usesAiValuation(asset.category)) {
    const { data: credit, error: creditError } = await supabase.rpc(
      "consume_ai_credit",
    );
    if (creditError) {
      return { error: "Couldn't check your daily estimate limit. Try again." };
    }
    const quota = Array.isArray(credit) ? credit[0] : credit;
    if (!quota?.allowed) {
      return {
        limited: true,
        error: `You've reached today's estimate limit (${quota?.daily_limit ?? 20} AI estimates per day). Try again tomorrow.`,
      };
    }
  }

  let result;
  try {
    result = await estimateAssetValue(asset);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Valuation failed. Please try again.",
    };
  }

  // Dedupe: re-estimating shouldn't stack near-identical rows. Compare against
  // the newest existing valuation (same deterministic ordering used everywhere).
  const { data: latestRows } = await supabase
    .from("asset_valuations")
    .select("value_low, value_high, source")
    .eq("asset_id", assetId)
    .order("valued_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  const latest = latestRows?.[0];
  const withinHalfPercent = (a: number, b: number) =>
    Math.abs(a - b) <= Math.max(Math.abs(b), 1) * 0.005;

  if (
    latest &&
    latest.source === result.source &&
    withinHalfPercent(result.valueLow, Number(latest.value_low)) &&
    withinHalfPercent(result.valueHigh, Number(latest.value_high))
  ) {
    return {
      ok: true,
      note: "Value is unchanged since the last estimate — no duplicate row added.",
    };
  }

  const { error: insertError } = await supabase.from("asset_valuations").insert({
    asset_id: assetId,
    value_low: result.valueLow,
    value_high: result.valueHigh,
    currency: result.currency,
    confidence: result.confidence,
    source: result.source,
    rationale: result.reasoning,
    sources: result.sources,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
  revalidatePath("/");
  return { ok: true };
}

export async function deletePhoto(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");
  const assetId = String(formData.get("asset_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Remove the file, then the row. RLS/storage policies scope both to the owner.
  if (storagePath) {
    await supabase.storage.from("asset-photos").remove([storagePath]);
  }
  await supabase.from("asset_photos").delete().eq("id", id);

  if (assetId) revalidatePath(`/assets/${assetId}`);
}
