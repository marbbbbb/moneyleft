"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { suggestExistingCategory } from "@/lib/categories";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900";

type FormState = { error?: string };
type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export type TransactionInitial = {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string | null;
  type: "income" | "expense";
};

export function TransactionForm({
  action,
  categories,
  initial,
  submitLabel,
}: {
  action: FormAction;
  categories: string[];
  initial?: TransactionInitial;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(initial);

  const [type, setType] = useState<"expense" | "income">(
    initial?.type ?? "expense",
  );
  const [category, setCategory] = useState(initial?.category ?? "");

  // Clear the form after a successful add (edit redirects, so this won't fire there).
  useEffect(() => {
    if (!isEdit && !pending && !state.error) {
      formRef.current?.reset();
      setType("expense");
      setCategory("");
    }
  }, [pending, state, isEdit]);

  const suggestion = suggestExistingCategory(category, categories);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="type" value={type} />

      {/* Expense / income toggle */}
      <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm dark:border-gray-700">
        <button
          type="button"
          onClick={() => setType("expense")}
          className={`min-h-11 flex-1 px-3 py-2 ${
            type === "expense"
              ? "bg-red-600 text-white"
              : "text-gray-600 dark:text-gray-300"
          }`}
        >
          − Expense
        </button>
        <button
          type="button"
          onClick={() => setType("income")}
          className={`min-h-11 flex-1 px-3 py-2 ${
            type === "income"
              ? "bg-green-600 text-white"
              : "text-gray-600 dark:text-gray-300"
          }`}
        >
          + Income
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            name="date"
            type="date"
            required
            defaultValue={initial?.date}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Amount
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            defaultValue={initial?.amount}
            placeholder="0.00"
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Category
        <input
          name="category"
          type="text"
          required
          list="tx-categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Groceries"
          autoComplete="off"
          className={inputClass}
        />
        <datalist id="tx-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {suggestion && (
          <span className="text-xs text-amber-700 dark:text-amber-500">
            Did you mean{" "}
            <button
              type="button"
              onClick={() => setCategory(suggestion)}
              className="font-medium underline"
            >
              {suggestion}
            </button>
            ?
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Note (optional)
        <input
          name="note"
          type="text"
          defaultValue={initial?.note ?? ""}
          className={inputClass}
        />
      </label>

      {/* Recurrence — only when creating (managed from the list afterwards) */}
      {!isEdit && (
        <label className="flex flex-col gap-1 text-sm">
          Repeat
          <select name="frequency" defaultValue="none" className={inputClass}>
            <option value="none">One-off (don&apos;t repeat)</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <span className="text-xs text-gray-500">
            Auto-creates each period (rent, subscriptions, salary). Manage under
            Recurring below.
          </span>
        </label>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : (submitLabel ?? "Add transaction")}
      </button>
    </form>
  );
}
