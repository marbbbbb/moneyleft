"use client";

import { useActionState } from "react";
import { saveSpendingRules } from "./actions";
import { SPENDER_TYPES } from "@/lib/rules";
import { currencyPlaceholder } from "@/lib/currencies";
import { Button, Field, Input, Select } from "@/components/ui";

export type RulesDefaults = {
  currency: string;
  monthlyCap: string;
  savingsTarget: string;
  category1: string;
  categoryLimit1: string;
  category2: string;
  categoryLimit2: string;
  spenderType: string;
  savingToward: string;
};

export function RulesForm({
  defaults,
  redirectTo,
}: {
  defaults: RulesDefaults;
  /** Where to send the user after a successful save. Defaults to /reminders (the settings-page behavior). */
  redirectTo?: string;
}) {
  const [state, action, pending] = useActionState(saveSpendingRules, {});
  const currency = defaults.currency;
  const amountPlaceholder = currencyPlaceholder(currency);

  return (
    <form action={action} className="flex flex-col gap-6">
      {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
      <input type="hidden" name="currency" value={currency} />
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">The big picture</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Rough numbers are fine — you can change these any time.
          </p>
        </div>

        <Field
          label={`What would you like to keep your total monthly spending under? (${currency})`}
          htmlFor="rules-monthly-cap"
        >
          <Input
            id="rules-monthly-cap"
            name="monthly_cap"
            type="number"
            step="1"
            min="0"
            defaultValue={defaults.monthlyCap}
            placeholder={`e.g. ${amountPlaceholder}`}
          />
        </Field>

        <Field
          label={`How much would you like to put aside each month? (${currency})`}
          htmlFor="rules-savings-target"
        >
          <Input
            id="rules-savings-target"
            name="savings_target"
            type="number"
            step="1"
            min="0"
            defaultValue={defaults.savingsTarget}
            placeholder={`e.g. ${amountPlaceholder}`}
          />
          <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
            Checked against income minus expenses. Skipped in months where you
            haven&apos;t recorded any income.
          </p>
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">Anything you want to keep an eye on?</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Pick up to two categories. Use the same names you use on transactions
            (e.g. Groceries, Dining).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category" htmlFor="rules-category-1">
            <Input
              id="rules-category-1"
              name="category_1"
              type="text"
              defaultValue={defaults.category1}
              placeholder="e.g. Dining"
            />
          </Field>
          <Field label={`Monthly limit (${currency})`} htmlFor="rules-category-limit-1">
            <Input
              id="rules-category-limit-1"
              name="category_limit_1"
              type="number"
              step="1"
              min="0"
              defaultValue={defaults.categoryLimit1}
              placeholder={`e.g. ${amountPlaceholder}`}
            />
          </Field>
          <Field label="Category (optional)" htmlFor="rules-category-2">
            <Input
              id="rules-category-2"
              name="category_2"
              type="text"
              defaultValue={defaults.category2}
              placeholder="e.g. Shopping"
            />
          </Field>
          <Field label={`Monthly limit (${currency})`} htmlFor="rules-category-limit-2">
            <Input
              id="rules-category-limit-2"
              name="category_limit_2"
              type="number"
              step="1"
              min="0"
              defaultValue={defaults.categoryLimit2}
              placeholder={`e.g. ${amountPlaceholder}`}
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">A little about you</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Only used to word your reminders in a way that suits you.
          </p>
        </div>

        <Field label="Which sounds more like you?" htmlFor="rules-spender-type">
          <Select
            id="rules-spender-type"
            name="spender_type"
            defaultValue={defaults.spenderType || "balanced"}
          >
            {SPENDER_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Anything you're saving toward?" htmlFor="rules-saving-toward">
          <Input
            id="rules-saving-toward"
            name="saving_toward"
            type="text"
            defaultValue={defaults.savingToward}
            placeholder="e.g. a trip, a home deposit, a rainy-day fund"
          />
        </Field>
      </section>

      {state.error && (
        <p className="text-[length:var(--t-sm)] text-[var(--neg)]">{state.error}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        className="self-start disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save my plan"}
      </Button>
      <p className="text-xs text-[var(--text-muted)]">
        Leave anything blank to skip it. Amounts above are in {currency}.
      </p>
    </form>
  );
}
