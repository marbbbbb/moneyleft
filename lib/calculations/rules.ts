import type { SupabaseClient } from "@supabase/supabase-js";
import { RULE_TYPES, type UserRule } from "@/lib/rules";
import { monthBounds } from "./spending";

// Evaluating rules is pure database math — free, deterministic, and no AI.
// The AI is only used later to word a reminder for a rule that is already,
// factually, broken.

export type RuleEvaluation = {
  rule: UserRule;
  label: string; // human-readable rule name
  actual: number; // what they've actually done this month
  target: number; // the limit/target they set
  broken: boolean;
  skipped?: string; // set when the rule can't be assessed yet
};

type TxRow = { category: string; amount: number; type: "income" | "expense" };

/**
 * Evaluates every active rule against the current month's transactions.
 *
 * Note: amounts are summed as recorded, matching the existing dashboard totals
 * (no FX conversion), so a rule compares against the same numbers the user
 * already sees on the spending summary.
 */
export async function evaluateRules(
  supabase: SupabaseClient,
  reference: Date = new Date(),
): Promise<RuleEvaluation[]> {
  const { data: ruleRows, error: ruleError } = await supabase
    .from("user_rules")
    .select("id, rule_type, description, category, amount, period, is_active")
    .eq("is_active", true);

  if (ruleError) throw ruleError;
  const rules = (ruleRows ?? []) as UserRule[];
  if (rules.length === 0) return [];

  const { start, end } = monthBounds(
    reference.getFullYear(),
    reference.getMonth() + 1,
  );

  const { data: txRows, error: txError } = await supabase
    .from("transactions")
    .select("category, amount, type")
    .gte("date", start)
    .lt("date", end);

  if (txError) throw txError;
  const transactions = (txRows ?? []) as TxRow[];

  let expenseTotal = 0;
  let incomeTotal = 0;
  const byCategory = new Map<string, number>();

  for (const t of transactions) {
    const amount = Number(t.amount) || 0;
    if (t.type === "income") {
      incomeTotal += amount;
    } else {
      expenseTotal += amount;
      const key = (t.category || "Uncategorized").toLowerCase();
      byCategory.set(key, (byCategory.get(key) ?? 0) + amount);
    }
  }

  return rules.map((rule): RuleEvaluation => {
    const target = Number(rule.amount) || 0;

    if (rule.rule_type === RULE_TYPES.monthlyCap) {
      return {
        rule,
        label: "Monthly spending limit",
        actual: expenseTotal,
        target,
        broken: expenseTotal > target,
      };
    }

    if (rule.rule_type === RULE_TYPES.categoryCap) {
      const key = (rule.category || "").toLowerCase();
      const actual = byCategory.get(key) ?? 0;
      return {
        rule,
        label: `${rule.category} limit`,
        actual,
        target,
        broken: actual > target,
      };
    }

    if (rule.rule_type === RULE_TYPES.savingsTarget) {
      const saved = incomeTotal - expenseTotal;
      // Without any income recorded this month, "saved" would just be negative
      // spending — not a real signal. Skip rather than nag.
      if (incomeTotal === 0) {
        return {
          rule,
          label: "Monthly savings target",
          actual: 0,
          target,
          broken: false,
          skipped: "No income recorded this month yet",
        };
      }
      return {
        rule,
        label: "Monthly savings target",
        actual: saved,
        target,
        broken: saved < target,
      };
    }

    return {
      rule,
      label: rule.description || rule.rule_type,
      actual: 0,
      target,
      broken: false,
      skipped: "Not automatically checked",
    };
  });
}
