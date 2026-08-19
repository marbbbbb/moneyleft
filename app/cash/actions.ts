"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CASH_ACCOUNT_TYPES } from "@/lib/cash";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionState = { error?: string };

// "I last checked my accounts on this day" - one stamp per cash save (add,
// edit, or delete), read by the dashboard's running-balance figure. Fire-and-
// forget like the rest of this file's secondary writes: a failure here (e.g.
// migration 015 not run yet) should never block the user's actual cash save.
// No explicit user_id filter needed - user_profiles is one row per user and
// RLS-scoped ("Owner full access": using (auth.uid() = user_id)), so an
// unfiltered update here only ever touches the signed-in user's own row, the
// same pattern markAllRemindersRead already uses in app/settings/actions.ts.
async function stampCashConfirmed(supabase: SupabaseClient) {
  await supabase
    .from("user_profiles")
    .update({ cash_confirmed_at: new Date().toISOString() });
}

function parseCashAccount(formData: FormData):
  | { error: string }
  | { ok: true; name: string; accountType: string; balance: number; currency: string } {
  const name = String(formData.get("name") ?? "").trim();
  const accountType = String(formData.get("account_type") ?? "").trim();
  const balance = Number(formData.get("balance"));
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();

  if (!name) return { error: "Name is required." };
  if (!(CASH_ACCOUNT_TYPES as readonly string[]).includes(accountType))
    return { error: "Invalid account type." };
  if (!Number.isFinite(balance)) return { error: "Balance must be a number." };
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency))
    return { error: "Unsupported currency." };

  return { ok: true, name, accountType, balance, currency };
}

export async function addCashAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseCashAccount(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  // user_id defaults to auth.uid() in the DB, and RLS enforces it on write.
  const { error } = await supabase.from("cash_accounts").insert({
    name: parsed.name,
    account_type: parsed.accountType,
    balance: parsed.balance,
    currency: parsed.currency,
  });

  if (error) return { error: error.message };

  await stampCashConfirmed(supabase);

  revalidatePath("/cash");
  revalidatePath("/"); // net worth homepage
  revalidatePath("/dashboard");
  return {};
}

export async function updateCashAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing account." };

  const parsed = parseCashAccount(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("cash_accounts")
    .update({
      name: parsed.name,
      account_type: parsed.accountType,
      balance: parsed.balance,
      currency: parsed.currency,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await stampCashConfirmed(supabase);

  revalidatePath("/cash");
  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect("/cash");
}

export async function deleteCashAccount(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // RLS guarantees a user can only delete rows they own.
  await supabase.from("cash_accounts").delete().eq("id", id);

  await stampCashConfirmed(supabase);

  revalidatePath("/cash");
  revalidatePath("/");
  revalidatePath("/dashboard");
}
