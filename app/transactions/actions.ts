"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runSpendingCheck } from "@/app/settings/actions";
import { normalizeCategory } from "@/lib/categories";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import type { SupabaseClient } from "@supabase/supabase-js";

// `ok` is an explicit success marker for the QR review sheet, which has no
// redirect to navigate on and cannot tell an empty `{}` apart from the
// initial useActionState state. The manual TransactionForm never reads it.
type ActionState = { error?: string; ok?: true; duplicateTransactionId?: string };

const FREQUENCIES = ["weekly", "monthly", "yearly"];

// Matches the validation cash-form's action already does for this same field.
function parseCurrency(formData: FormData): string | null {
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) return null;
  return currency;
}

// Extra columns written only when a transaction comes from the QR-scan review
// sheet (migration 016). The manual add-transaction form sends none of these
// fields, so parseEInvoiceFields returns null and the insert below is
// byte-for-byte what it has always been (source then defaults to 'manual' in
// the DB). When source === 'qr_scan', all four e-invoice columns are merged in.
type EInvoiceInsert = {
  source: "qr_scan";
  einvoice_number: string | null;
  einvoice_date: string | null;
  einvoice_random_code: string | null;
  einvoice_seller_id: string | null;
};

function parseEInvoiceFields(formData: FormData): EInvoiceInsert | null {
  if (formData.get("source") !== "qr_scan") return null;
  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v || null;
  };
  return {
    source: "qr_scan",
    einvoice_number: str("einvoice_number"),
    einvoice_date: str("einvoice_date"),
    einvoice_random_code: str("einvoice_random_code"),
    einvoice_seller_id: str("einvoice_seller_id"),
  };
}

// Distinct categories the user already uses (one display spelling per case-set).
async function fetchCategories(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("transactions").select("category");
  const seen = new Map<string, string>();
  for (const row of data ?? []) {
    const c = String((row as { category: string }).category ?? "").trim();
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }
  return [...seen.values()];
}

function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1); // monthly
  return d.toISOString().slice(0, 10);
}

export async function addTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const date = String(formData.get("date") ?? "");
  const amount = Number(formData.get("amount"));
  const rawCategory = String(formData.get("category") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const type = formData.get("type") === "income" ? "income" : "expense";
  const frequency = String(formData.get("frequency") ?? "none");
  const currency = parseCurrency(formData);

  if (!date) return { error: "Date is required." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Amount must be a positive number." };
  if (!rawCategory.trim()) return { error: "Category is required." };
  if (!currency) return { error: "Unsupported currency." };

  const supabase = await createClient();
  const category = normalizeCategory(rawCategory, await fetchCategories(supabase));

  const einvoice = parseEInvoiceFields(formData);

  const { error } = await supabase.from("transactions").insert({
    date,
    amount: Math.abs(amount),
    category,
    note: note || null,
    type,
    currency,
    ...(einvoice ?? {}),
  });
  if (error) {
    // The partial unique index (user_id, einvoice_number) from migration 016
    // rejects a second scan of the same receipt. Surface that as a state the
    // review sheet can recognise - "Already scanned", with a link to the
    // original - rather than a raw Postgres error string.
    if (error.code === "23505" && einvoice?.einvoice_number) {
      const { data: existing } = await supabase
        .from("transactions")
        .select("id")
        .eq("einvoice_number", einvoice.einvoice_number)
        .maybeSingle();
      return {
        error: "Already scanned.",
        duplicateTransactionId: existing?.id ?? undefined,
      };
    }
    return { error: error.message };
  }

  // If marked recurring, store a template dated one period out; the catch-up
  // engine materializes future occurrences from there.
  if (FREQUENCIES.includes(frequency)) {
    await supabase.from("recurring_transactions").insert({
      amount: Math.abs(amount),
      category,
      note: note || null,
      type,
      currency,
      frequency,
      next_run: advanceDate(date, frequency),
    });
    revalidatePath("/transactions");
  }

  // Adding an expense is when a limit can be crossed — deduped, cheap when
  // nothing newly breaks (see settings/actions).
  if (type === "expense") {
    try {
      await runSpendingCheck();
    } catch {
      // Never fail a saved transaction because a reminder couldn't be generated.
    }
  }

  revalidatePath("/transactions");
  return { ok: true };
}

export async function updateTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing transaction." };

  const date = String(formData.get("date") ?? "");
  const amount = Number(formData.get("amount"));
  const rawCategory = String(formData.get("category") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const type = formData.get("type") === "income" ? "income" : "expense";
  const currency = parseCurrency(formData);

  if (!date) return { error: "Date is required." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Amount must be a positive number." };
  if (!rawCategory.trim()) return { error: "Category is required." };
  if (!currency) return { error: "Unsupported currency." };

  const supabase = await createClient();
  const category = normalizeCategory(rawCategory, await fetchCategories(supabase));

  const { error } = await supabase
    .from("transactions")
    .update({ date, amount: Math.abs(amount), category, note: note || null, type, currency })
    .eq("id", id);
  if (error) return { error: error.message };

  if (type === "expense") {
    try {
      await runSpendingCheck();
    } catch {}
  }

  revalidatePath("/transactions");
  revalidatePath("/reminders");
  redirect("/transactions");
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("transactions").delete().eq("id", id);

  revalidatePath("/transactions");
}

export async function cancelRecurring(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("recurring_transactions")
    .update({ is_active: false })
    .eq("id", id);

  revalidatePath("/transactions");
}

/**
 * Creates any transactions that are due from active recurring templates, up to
 * today. Idempotent: each template's next_run advances past what it created, so
 * re-running never duplicates. Safe to call on page load (no revalidation — the
 * caller reads fresh rows in the same request).
 */
export async function materializeRecurring(): Promise<number> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: templates } = await supabase
    .from("recurring_transactions")
    .select("id, amount, category, note, type, currency, frequency, next_run")
    .eq("is_active", true)
    .lte("next_run", today);

  if (!templates || templates.length === 0) return 0;

  let created = 0;
  for (const t of templates) {
    const inserts: Record<string, unknown>[] = [];
    let next = t.next_run as string;
    let guard = 0;
    while (next <= today && guard < 120) {
      inserts.push({
        date: next,
        amount: t.amount,
        category: t.category,
        note: t.note,
        type: t.type,
        currency: t.currency,
      });
      next = advanceDate(next, t.frequency as string);
      guard++;
    }
    if (inserts.length === 0) continue;

    const { error } = await supabase.from("transactions").insert(inserts);
    if (!error) {
      await supabase
        .from("recurring_transactions")
        .update({ next_run: next })
        .eq("id", t.id);
      created += inserts.length;
    }
  }
  return created;
}
