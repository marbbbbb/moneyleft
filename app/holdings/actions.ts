"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deriveCurrency, SUPPORTED_CURRENCIES } from "@/lib/tickers";

type ActionState = { error?: string };

// Shared parse + validate for add and update.
function parseHolding(formData: FormData):
  | { error: string }
  | { ok: true; ticker: string; shares: number; cost_basis: number; date_bought: string; currency: string } {
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  const shares = Number(formData.get("shares"));
  const cost_basis = Number(formData.get("cost_basis"));
  const date_bought = String(formData.get("date_bought") ?? "");
  const submitted = String(formData.get("currency") ?? "").trim().toUpperCase();
  const currency = (SUPPORTED_CURRENCIES as readonly string[]).includes(submitted)
    ? submitted
    : deriveCurrency(ticker);

  if (!ticker) return { error: "Ticker is required." };
  if (!Number.isFinite(shares) || shares <= 0)
    return { error: "Shares must be a positive number." };
  if (!Number.isFinite(cost_basis))
    return { error: "Cost basis must be a number." };
  if (!date_bought) return { error: "Date bought is required." };

  return { ok: true, ticker, shares, cost_basis, date_bought, currency };
}

export async function addHolding(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseHolding(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  // user_id defaults to auth.uid() in the DB, and RLS enforces it on write.
  const { error } = await supabase.from("holdings").insert({
    ticker: parsed.ticker,
    shares: parsed.shares,
    cost_basis: parsed.cost_basis,
    date_bought: parsed.date_bought,
    currency: parsed.currency,
  });

  if (error) return { error: error.message };

  revalidatePath("/holdings");
  return {};
}

export async function updateHolding(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing holding." };

  const parsed = parseHolding(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("holdings")
    .update({
      ticker: parsed.ticker,
      shares: parsed.shares,
      cost_basis: parsed.cost_basis,
      date_bought: parsed.date_bought,
      currency: parsed.currency,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/holdings");
  revalidatePath("/portfolio");
  redirect("/holdings");
}

export async function deleteHolding(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // RLS guarantees a user can only delete rows they own.
  await supabase.from("holdings").delete().eq("id", id);

  revalidatePath("/holdings");
}
