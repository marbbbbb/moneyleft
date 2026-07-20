"use client";

import { useActionState, useEffect, useRef } from "react";
import { CASH_ACCOUNT_TYPES } from "@/lib/cash";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900";

type FormState = { error?: string };
type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export type CashInitial = {
  id: string;
  name: string;
  account_type: string;
  balance: number;
  currency: string;
};

export function CashForm({
  action,
  initial,
  submitLabel,
}: {
  action: FormAction;
  initial?: CashInitial;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(initial);

  useEffect(() => {
    if (!isEdit && !pending && !state.error) formRef.current?.reset();
  }, [pending, state, isEdit]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            type="text"
            required
            defaultValue={initial?.name}
            placeholder="e.g. Cathay Savings"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="account_type"
            defaultValue={initial?.account_type ?? "checking"}
            className={inputClass}
          >
            {CASH_ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Balance
          <input
            name="balance"
            type="number"
            step="0.01"
            required
            defaultValue={initial?.balance}
            placeholder="0.00"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Currency
          <select
            name="currency"
            defaultValue={initial?.currency ?? "TWD"}
            className={inputClass}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : (submitLabel ?? "Add account")}
      </button>
    </form>
  );
}
