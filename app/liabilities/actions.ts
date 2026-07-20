"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LIABILITY_TYPE_VALUES } from "@/lib/liabilities";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import { currentBalance } from "@/lib/amortization";

type ActionState = { error?: string };

type CommonFields = {
  name: string;
  liabilityType: string;
  currency: string;
  interestRate: number | null;
};

type SimpleFields = CommonFields & {
  kind: "simple";
  balance: number;
};

type AmortizingFields = CommonFields & {
  kind: "amortizing";
  originalPrincipal: number;
  termMonths: number;
  startDate: string;
  interestRate: number; // required (may be 0) for a loan — narrower than CommonFields
};

// Fields shared by both kinds, validated the same way regardless of kind.
function parseCommon(formData: FormData):
  | { error: string }
  | { ok: true; fields: CommonFields } {
  const name = String(formData.get("name") ?? "").trim();
  const liabilityType = String(formData.get("liability_type") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const rateRaw = String(formData.get("interest_rate") ?? "").trim();
  const interestRate = rateRaw === "" ? null : Number(rateRaw);

  if (!name) return { error: "Name is required." };
  if (!LIABILITY_TYPE_VALUES.includes(liabilityType as never))
    return { error: "Invalid liability type." };
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency))
    return { error: "Unsupported currency." };
  if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0))
    return { error: "Interest rate must be a non-negative number." };

  return { ok: true, fields: { name, liabilityType, currency, interestRate } };
}

// Validated server-side in addition to the client-side checks in the form —
// never trust the client alone. Mirrors "Loan requires original amount > 0,
// term > 0, and a start date. Interest rate may be 0."
function parseLiability(
  formData: FormData,
):
  | { error: string }
  | { ok: true; data: SimpleFields }
  | { ok: true; data: AmortizingFields } {
  const common = parseCommon(formData);
  if ("error" in common) return { error: common.error };

  const kind = formData.get("kind") === "amortizing" ? "amortizing" : "simple";

  if (kind === "simple") {
    const balance = Number(formData.get("balance"));
    if (!Number.isFinite(balance) || balance < 0)
      return { error: "Balance must be a non-negative number." };
    return { ok: true, data: { ...common.fields, kind, balance } };
  }

  // Amortizing: original amount, term, and start date are required; interest
  // rate is required too but 0 is a valid rate, not a missing one.
  const originalPrincipal = Number(formData.get("original_principal"));
  const termYearsRaw = String(formData.get("term_years") ?? "").trim();
  const termYears = Number(termYearsRaw);
  const startDate = String(formData.get("start_date") ?? "").trim();

  if (!Number.isFinite(originalPrincipal) || originalPrincipal <= 0)
    return { error: "Original amount must be a positive number." };
  if (common.fields.interestRate === null)
    return { error: "Interest rate is required for a loan (0 is fine)." };
  if (!Number.isFinite(termYears) || termYears <= 0)
    return { error: "Term must be a positive number of years." };
  if (!startDate) return { error: "Start date is required for a loan." };

  const termMonths = Math.round(termYears * 12);
  if (termMonths < 1) return { error: "Term must be at least one month." };

  return {
    ok: true,
    data: {
      ...common.fields,
      interestRate: common.fields.interestRate,
      kind,
      originalPrincipal,
      termMonths,
      startDate,
    },
  };
}

// Optional "correct the balance" anchor, read only for amortizing updates.
// Both fields must be present together, or both absent (clearing any prior
// anchor) — a lone balance or date is meaningless to the amortization math.
function parseAnchor(
  formData: FormData,
): { error: string } | { ok: true; anchorBalance: number | null; anchorDate: string | null } {
  const balanceRaw = String(formData.get("anchor_balance") ?? "").trim();
  const dateRaw = String(formData.get("anchor_date") ?? "").trim();

  if (balanceRaw === "" && dateRaw === "") {
    return { ok: true, anchorBalance: null, anchorDate: null };
  }
  if (balanceRaw === "" || dateRaw === "") {
    return {
      error: "Provide both a corrected balance and a date, or leave both blank.",
    };
  }
  const anchorBalance = Number(balanceRaw);
  if (!Number.isFinite(anchorBalance) || anchorBalance < 0) {
    return { error: "Corrected balance must be a non-negative number." };
  }
  return { ok: true, anchorBalance, anchorDate: dateRaw };
}

// The stored `balance` column stays a meaningful snapshot even for amortizing
// rows (harmlessly ignored while kind='amortizing'), so that flipping a loan
// back to "Simple balance" later shows a sensible number instead of 0 or
// stale data. Computed via the same lib/amortization.ts used everywhere else
// — no duplicate math.
function snapshotBalance(
  data: AmortizingFields,
  anchorBalance: number | null,
  anchorDate: string | null,
): number {
  return currentBalance(
    {
      kind: "amortizing",
      balance: 0,
      interest_rate: data.interestRate,
      original_principal: data.originalPrincipal,
      term_months: data.termMonths,
      start_date: data.startDate,
      monthly_payment: null,
      anchor_balance: anchorBalance,
      anchor_date: anchorDate,
    },
    new Date(),
  );
}

export async function addLiability(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseLiability(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { data } = parsed;

  const supabase = await createClient();

  // One flat row shape (not a branch-typed union) so it type-checks cleanly
  // against Supabase's insert() overloads. No anchor section on Add
  // (edit-only, per spec) — original_principal/term_months/start_date stay
  // null for a simple row, since currentBalance() never reads them for
  // kind='simple'.
  const row = {
    name: data.name,
    liability_type: data.liabilityType,
    currency: data.currency,
    interest_rate: data.interestRate,
    kind: data.kind,
    balance: data.kind === "simple" ? data.balance : snapshotBalance(data, null, null),
    original_principal: data.kind === "amortizing" ? data.originalPrincipal : null,
    term_months: data.kind === "amortizing" ? data.termMonths : null,
    start_date: data.kind === "amortizing" ? data.startDate : null,
  };

  const { error } = await supabase.from("liabilities").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/liabilities");
  revalidatePath("/"); // net worth
  return {};
}

export async function updateLiability(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing liability." };

  const parsed = parseLiability(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { data } = parsed;

  const supabase = await createClient();

  if (data.kind === "simple") {
    // Loan-only columns (original_principal, term_months, start_date, anchor)
    // are deliberately left untouched here — currentBalance() never reads
    // them while kind='simple', so stale values are inert, and preserving
    // them means flipping back to "Loan" later restores what was entered.
    const { error } = await supabase
      .from("liabilities")
      .update({
        name: data.name,
        liability_type: data.liabilityType,
        currency: data.currency,
        interest_rate: data.interestRate,
        kind: "simple",
        balance: data.balance,
      })
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const anchor = parseAnchor(formData);
    if ("error" in anchor) return { error: anchor.error };

    const { error } = await supabase
      .from("liabilities")
      .update({
        name: data.name,
        liability_type: data.liabilityType,
        currency: data.currency,
        interest_rate: data.interestRate,
        kind: "amortizing",
        original_principal: data.originalPrincipal,
        term_months: data.termMonths,
        start_date: data.startDate,
        anchor_balance: anchor.anchorBalance,
        anchor_date: anchor.anchorDate,
        balance: snapshotBalance(data, anchor.anchorBalance, anchor.anchorDate),
      })
      .eq("id", id);
    if (error) return { error: error.message };
  }

  revalidatePath("/liabilities");
  revalidatePath("/");
  redirect("/liabilities");
}

export async function deleteLiability(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("liabilities").delete().eq("id", id);

  revalidatePath("/liabilities");
  revalidatePath("/");
}
