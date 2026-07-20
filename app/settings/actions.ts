"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QUIZ_RULE_TYPES, RULE_TYPES } from "@/lib/rules";
import { evaluateRules } from "@/lib/calculations/rules";
import { monthBounds } from "@/lib/calculations/spending";
import { generateReminder } from "@/lib/reminders/engine";
import { cleanCategory, normalizeCategory } from "@/lib/categories";

type SaveState = { error?: string; ok?: boolean };

// Reads an optional positive number from the form; blank => null.
function optionalAmount(formData: FormData, key: string): number | null | "bad" {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return "bad";
  return n;
}

export async function saveSpendingRules(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const monthlyCap = optionalAmount(formData, "monthly_cap");
  const savingsTarget = optionalAmount(formData, "savings_target");
  let cat1 = String(formData.get("category_1") ?? "").trim();
  const limit1 = optionalAmount(formData, "category_limit_1");
  let cat2 = String(formData.get("category_2") ?? "").trim();
  const limit2 = optionalAmount(formData, "category_limit_2");
  const spenderType = String(formData.get("spender_type") ?? "").trim();
  const savingToward = String(formData.get("saving_toward") ?? "").trim();

  if (
    monthlyCap === "bad" ||
    savingsTarget === "bad" ||
    limit1 === "bad" ||
    limit2 === "bad"
  ) {
    return { error: "Amounts must be positive numbers." };
  }
  if (cat1 && limit1 === null)
    return { error: `Add a monthly limit for "${cat1}", or clear the category.` };
  if (cat2 && limit2 === null)
    return { error: `Add a monthly limit for "${cat2}", or clear the category.` };

  const supabase = await createClient();

  // Replace only the rules this quiz owns, so re-taking it is idempotent and
  // never touches rules created elsewhere.
  const { error: deleteError } = await supabase
    .from("user_rules")
    .delete()
    .in("rule_type", QUIZ_RULE_TYPES);
  if (deleteError) return { error: deleteError.message };

  // Canonicalize rule categories against categories already in use, so a limit
  // typed as "dining" matches existing "Dining" transactions.
  const { data: catRows } = await supabase.from("transactions").select("category");
  const existingCategories = [
    ...new Map(
      (catRows ?? [])
        .map((r) => String((r as { category: string }).category ?? "").trim())
        .filter(Boolean)
        .map((c) => [c.toLowerCase(), c]),
    ).values(),
  ];
  cat1 = cat1 ? normalizeCategory(cat1, existingCategories) : cat1;
  cat2 = cat2 ? normalizeCategory(cat2, existingCategories) : cat2;

  const rules: Record<string, unknown>[] = [];
  if (monthlyCap !== null) {
    rules.push({
      rule_type: RULE_TYPES.monthlyCap,
      description: "Keep total monthly spending under this",
      amount: monthlyCap,
      period: "monthly",
    });
  }
  if (savingsTarget !== null) {
    rules.push({
      rule_type: RULE_TYPES.savingsTarget,
      description: "Put aside at least this much each month",
      amount: savingsTarget,
      period: "monthly",
    });
  }
  for (const [cat, limit] of [
    [cat1, limit1],
    [cat2, limit2],
  ] as [string, number | null][]) {
    if (cat && limit !== null) {
      rules.push({
        rule_type: RULE_TYPES.categoryCap,
        description: `Watching ${cat}`,
        category: cat,
        amount: limit,
        period: "monthly",
      });
    }
  }

  if (rules.length > 0) {
    const { error: insertError } = await supabase.from("user_rules").insert(rules);
    if (insertError) return { error: insertError.message };
  }

  // Soft answers are context for the reminder wording, not checkable rules.
  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: (await supabase.auth.getUser()).data.user?.id,
      onboarding: {
        spender_type: spenderType || null,
        saving_toward: savingToward || null,
      },
      onboarding_completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (profileError) return { error: profileError.message };

  revalidatePath("/settings");
  revalidatePath("/reminders");
  revalidatePath("/");
  redirect("/reminders");
}

type CheckState = {
  error?: string;
  ok?: boolean;
  note?: string;
  limited?: boolean;
};

/**
 * Evaluates rules (free) and generates an AI reminder only for rules that are
 * newly broken this month. Deduped per rule per month, so re-checking costs
 * nothing once a reminder already exists — which is what makes it safe to run
 * automatically on every visit to the Reminders page.
 */
export async function runSpendingCheck(): Promise<CheckState> {
  const supabase = await createClient();

  let evaluations;
  try {
    evaluations = await evaluateRules(supabase);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Couldn't check your rules.",
    };
  }

  if (evaluations.length === 0) {
    return { ok: true, note: "No rules set yet — add some in Settings." };
  }

  const broken = evaluations.filter((e) => e.broken);
  if (broken.length === 0) {
    return { ok: true, note: "You're within all your limits right now. Nothing to flag." };
  }

  // Dedupe: one reminder per rule per month.
  const now = new Date();
  const { start, end } = monthBounds(now.getFullYear(), now.getMonth() + 1);
  const { data: existing } = await supabase
    .from("notifications")
    .select("rule_id")
    .gte("created_at", start)
    .lt("created_at", end);

  const alreadyNotified = new Set(
    (existing ?? []).map((n: { rule_id: string | null }) => n.rule_id),
  );
  const pending = broken.filter((b) => !alreadyNotified.has(b.rule.id));

  if (pending.length === 0) {
    return {
      ok: true,
      note: "You already have reminders for everything that's over this month.",
    };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding")
    .maybeSingle();
  const onboarding = (profile?.onboarding ?? {}) as {
    spender_type?: string | null;
    saving_toward?: string | null;
  };

  let created = 0;
  for (const item of pending) {
    // Shared daily AI budget — spend the credit before calling the API.
    const { data: credit, error: creditError } = await supabase.rpc(
      "consume_ai_credit",
    );
    if (creditError) {
      return { error: "Couldn't check your daily AI limit. Try again." };
    }
    const quota = Array.isArray(credit) ? credit[0] : credit;
    if (!quota?.allowed) {
      return {
        ok: created > 0,
        limited: true,
        error: `You've reached today's AI limit (${quota?.daily_limit ?? 20} per day). Try again tomorrow.`,
      };
    }

    try {
      const message = await generateReminder({
        ruleLabel: item.label,
        actual: item.actual,
        target: item.target,
        category: item.rule.category,
        isSavingsTarget: item.rule.rule_type === RULE_TYPES.savingsTarget,
        spenderType: onboarding.spender_type,
        savingToward: onboarding.saving_toward,
      });

      const { error: insertError } = await supabase.from("notifications").insert({
        rule_id: item.rule.id,
        title: message.title,
        body: message.body,
        severity: "warning",
      });
      if (insertError) return { error: insertError.message };
      created++;
    } catch (e) {
      return {
        ok: created > 0,
        error: e instanceof Error ? e.message : "Couldn't write a reminder.",
      };
    }
  }

  revalidatePath("/reminders");
  return {
    ok: true,
    note: `${created} new reminder${created === 1 ? "" : "s"} added below.`,
  };
}

/**
 * Called once the user is actually looking at the Reminders page, to quiet the
 * nav badge.
 *
 * Deliberately does NOT revalidate /reminders: the page they're reading keeps
 * its "new" highlighting for this visit, while the badge clears everywhere else.
 */
export async function markAllRemindersRead(): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);

  revalidatePath("/");
  revalidatePath("/settings");
}

type MergeState = { error?: string; ok?: boolean; note?: string };

/**
 * Merges duplicate categories into one canonical spelling: rewrites every
 * matching transaction (and any category rule) to the target. This is the manual
 * cleanup for splits that already happened.
 */
export async function mergeCategories(
  _prev: MergeState,
  formData: FormData,
): Promise<MergeState> {
  const sources = formData.getAll("sources").map((s) => String(s));
  const target = cleanCategory(String(formData.get("target") ?? ""));

  if (!target) return { error: "Choose a target category to merge into." };
  if (sources.length === 0)
    return { error: "Select at least one category to merge." };

  // Merging a category into itself is a no-op; drop the target from the sources.
  const toRewrite = sources.filter((s) => s !== target);
  if (toRewrite.length === 0)
    return { error: "Pick categories different from the target." };

  const supabase = await createClient();

  const { error, count } = await supabase
    .from("transactions")
    .update({ category: target }, { count: "exact" })
    .in("category", toRewrite);
  if (error) return { error: error.message };

  // Keep category-limit rules pointing at the surviving name.
  await supabase
    .from("user_rules")
    .update({ category: target })
    .eq("rule_type", RULE_TYPES.categoryCap)
    .in("category", toRewrite);

  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/reminders");
  return {
    ok: true,
    note: `Merged ${toRewrite.length} categor${toRewrite.length === 1 ? "y" : "ies"} into "${target}" (${count ?? 0} transactions updated).`,
  };
}
