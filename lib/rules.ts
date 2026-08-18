// Shared spending-rule types and labels. Pure module — safe on client + server.

export const RULE_TYPES = {
  monthlyCap: "monthly_spending_cap",
  categoryCap: "category_spending_cap",
  savingsTarget: "monthly_savings_target",
} as const;

// The rule types the onboarding quiz owns (re-saving the quiz replaces these,
// and only these — any other rule types are left alone).
export const QUIZ_RULE_TYPES: string[] = [
  RULE_TYPES.monthlyCap,
  RULE_TYPES.categoryCap,
  RULE_TYPES.savingsTarget,
];

export const SPENDER_TYPES = [
  { value: "saver", label: "I'm a natural saver" },
  { value: "balanced", label: "Somewhere in the middle" },
  { value: "spender", label: "I like to spend freely" },
] as const;

export type UserRule = {
  id: string;
  rule_type: string;
  description: string | null;
  category: string | null;
  amount: number | null;
  period: string | null;
  is_active: boolean;
  currency?: string;
};

export function formatAmount(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
