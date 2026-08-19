"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { suggestExistingCategory } from "@/lib/categories";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import { Button, Field, Input, Select } from "@/components/ui";

type FormState = { error?: string };
type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export type TransactionInitial = {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string | null;
  type: "income" | "expense";
  currency: string;
};

export function TransactionForm({
  action,
  categories,
  initial,
  submitLabel,
  onSuccess,
}: {
  action: FormAction;
  categories: string[];
  initial?: TransactionInitial;
  submitLabel?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(initial);
  const isFirstRender = useRef(true);

  const [type, setType] = useState<"expense" | "income">(
    initial?.type ?? "expense",
  );
  const [category, setCategory] = useState(initial?.category ?? "");

  // Clear the form after a successful add (edit redirects, so this won't fire there).
  useEffect(() => {
    const wasFirstRender = isFirstRender.current;
    isFirstRender.current = false;
    if (!isEdit && !pending && !state.error) {
      formRef.current?.reset();
      setType("expense");
      setCategory("");
      if (!wasFirstRender) onSuccess?.();
    }
    // onSuccess intentionally omitted: it's a fresh closure from the parent
    // every render (AddTransactionPanel re-renders on open/close), and
    // including it would re-run this effect on every panel toggle, calling
    // onSuccess immediately after opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state, isEdit]);

  const suggestion = suggestExistingCategory(category, categories);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-[var(--sp-4)]">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="type" value={type} />

      {/* Expense / income toggle */}
      <div className="flex gap-[var(--sp-2)]">
        <Button
          type="button"
          variant={type === "expense" ? "primary" : "secondary"}
          onClick={() => setType("expense")}
          className="flex-1"
        >
          − Expense
        </Button>
        <Button
          type="button"
          variant={type === "income" ? "primary" : "secondary"}
          onClick={() => setType("income")}
          className="flex-1"
        >
          + Income
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-[var(--sp-3)]">
        <Field label="Amount" htmlFor="tx-amount">
          <Input
            id="tx-amount"
            name="amount"
            type="number"
            step="0.01"
            required
            defaultValue={initial?.amount}
            placeholder="0.00"
            className="text-[length:var(--t-lg)]"
          />
        </Field>

        <Field label="Currency" htmlFor="tx-currency">
          <Select id="tx-currency" name="currency" defaultValue={initial?.currency ?? "TWD"}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-[var(--sp-4)] sm:grid-cols-2">
        <Field label="Date" htmlFor="tx-date">
          <Input
            id="tx-date"
            name="date"
            type="date"
            required
            defaultValue={initial?.date}
          />
        </Field>

        <Field label="Category" htmlFor="tx-category">
          <Input
            id="tx-category"
            name="category"
            type="text"
            required
            list="tx-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Groceries"
            autoComplete="off"
          />
          <datalist id="tx-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {suggestion && (
            <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
              Did you mean{" "}
              <button
                type="button"
                onClick={() => setCategory(suggestion)}
                className="font-medium text-[var(--accent)] underline"
              >
                {suggestion}
              </button>
              ?
            </p>
          )}
        </Field>
      </div>

      <Field label="Note (optional)" htmlFor="tx-note">
        <Input
          id="tx-note"
          name="note"
          type="text"
          defaultValue={initial?.note ?? ""}
        />
      </Field>

      {/* Recurrence — only when creating (managed from the list afterwards) */}
      {!isEdit && (
        <Field label="Repeat" htmlFor="tx-frequency">
          <Select id="tx-frequency" name="frequency" defaultValue="none">
            <option value="none">One-off (don&apos;t repeat)</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
          <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
            Auto-creates each period (rent, subscriptions, salary). Manage under
            Recurring below.
          </p>
        </Field>
      )}

      {state.error && (
        <p className="text-[length:var(--t-sm)] text-[var(--neg)]">{state.error}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        className="self-start disabled:opacity-50"
      >
        {pending ? "Saving…" : (submitLabel ?? "Add transaction")}
      </Button>
    </form>
  );
}
