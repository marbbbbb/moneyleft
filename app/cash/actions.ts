"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CASH_ACCOUNT_TYPES } from "@/lib/cash";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";

type ActionState = { error?: string };

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

  revalidatePath("/cash");
  revalidatePath("/"); // net worth homepage
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

  revalidatePath("/cash");
  revalidatePath("/");
  redirect("/cash");
}

export async function deleteCashAccount(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // RLS guarantees a user can only delete rows they own.
  await supabase.from("cash_accounts").delete().eq("id", id);

  revalidatePath("/cash");
  revalidatePath("/");
}
