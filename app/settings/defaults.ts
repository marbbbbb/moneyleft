import { createClient } from "@/lib/supabase/server";
import { RULE_TYPES, type UserRule } from "@/lib/rules";
import type { RulesDefaults } from "./rules-form";

const asText = (n: number | string | null | undefined) =>
  n === null || n === undefined ? "" : String(n);

/** Loads the user's existing rules so the quiz prefills when re-taken. */
export async function loadRulesDefaults(): Promise<{
  defaults: RulesDefaults;
  completed: boolean;
  // The savings-target rule's OWN stored currency — distinct from
  // defaults.currency (preferred_currency, the base-currency signal used to
  // prefill/label the form). Read by the dashboard's safe-to-spend block,
  // which needs to know what currency an EXISTING rule was actually saved in,
  // not what the user's current preference is.
  savingsTargetCurrency: string | null;
}> {
  const supabase = await createClient();

  const [{ data: ruleRows }, { data: profile }] = await Promise.all([
    supabase
      .from("user_rules")
      .select("id, rule_type, description, category, amount, period, is_active, currency")
      .order("created_at", { ascending: true }),
    supabase
      .from("user_profiles")
      .select("onboarding, onboarding_completed_at, preferred_currency")
      .maybeSingle(),
  ]);

  const rules = (ruleRows ?? []) as UserRule[];
  const cap = rules.find((r) => r.rule_type === RULE_TYPES.monthlyCap);
  const savings = rules.find((r) => r.rule_type === RULE_TYPES.savingsTarget);
  const categories = rules.filter((r) => r.rule_type === RULE_TYPES.categoryCap);

  const onboarding = (profile?.onboarding ?? {}) as {
    spender_type?: string | null;
    saving_toward?: string | null;
  };

  return {
    completed: Boolean(profile?.onboarding_completed_at),
    savingsTargetCurrency: savings?.currency ?? null,
    defaults: {
      currency: profile?.preferred_currency ?? "TWD",
      monthlyCap: asText(cap?.amount),
      savingsTarget: asText(savings?.amount),
      category1: categories[0]?.category ?? "",
      categoryLimit1: asText(categories[0]?.amount),
      category2: categories[1]?.category ?? "",
      categoryLimit2: asText(categories[1]?.amount),
      spenderType: onboarding.spender_type ?? "",
      savingToward: onboarding.saving_toward ?? "",
    },
  };
}
