"use client";

import { useActionState } from "react";
import { saveSpendingRules } from "./actions";
import { SPENDER_TYPES } from "@/lib/rules";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900";

export type RulesDefaults = {
  monthlyCap: string;
  savingsTarget: string;
  category1: string;
  categoryLimit1: string;
  category2: string;
  categoryLimit2: string;
  spenderType: string;
  savingToward: string;
};

export function RulesForm({ defaults }: { defaults: RulesDefaults }) {
  const [state, action, pending] = useActionState(saveSpendingRules, {});

  return (
    <form action={action} className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">The big picture</h2>
          <p className="text-sm text-gray-500">
            Rough numbers are fine — you can change these any time.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          What would you like to keep your total monthly spending under?
          <input
            name="monthly_cap"
            type="number"
            step="1"
            min="0"
            defaultValue={defaults.monthlyCap}
            placeholder="e.g. 40000"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          How much would you like to put aside each month?
          <input
            name="savings_target"
            type="number"
            step="1"
            min="0"
            defaultValue={defaults.savingsTarget}
            placeholder="e.g. 15000"
            className={inputClass}
          />
          <span className="text-xs text-gray-500">
            Checked against income minus expenses. Skipped in months where you
            haven&apos;t recorded any income.
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">Anything you want to keep an eye on?</h2>
          <p className="text-sm text-gray-500">
            Pick up to two categories. Use the same names you use on transactions
            (e.g. Groceries, Dining).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Category
            <input
              name="category_1"
              type="text"
              defaultValue={defaults.category1}
              placeholder="e.g. Dining"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Monthly limit
            <input
              name="category_limit_1"
              type="number"
              step="1"
              min="0"
              defaultValue={defaults.categoryLimit1}
              placeholder="e.g. 6000"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Category (optional)
            <input
              name="category_2"
              type="text"
              defaultValue={defaults.category2}
              placeholder="e.g. Shopping"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Monthly limit
            <input
              name="category_limit_2"
              type="number"
              step="1"
              min="0"
              defaultValue={defaults.categoryLimit2}
              placeholder="e.g. 5000"
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">A little about you</h2>
          <p className="text-sm text-gray-500">
            Only used to word your reminders in a way that suits you.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Which sounds more like you?
          <select
            name="spender_type"
            defaultValue={defaults.spenderType || "balanced"}
            className={inputClass}
          >
            {SPENDER_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Anything you&apos;re saving toward?
          <input
            name="saving_toward"
            type="text"
            defaultValue={defaults.savingToward}
            placeholder="e.g. a trip, a home deposit, a rainy-day fund"
            className={inputClass}
          />
        </label>
      </section>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending}
        className="self-start rounded-md bg-black min-h-11 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Save my rules"}
      </button>
      <p className="text-xs text-gray-500">
        Leave anything blank to skip it. Amounts are in whatever currency you
        record transactions in.
      </p>
    </form>
  );
}
