"use client";

import { useActionState, useEffect, useRef } from "react";
import { CASH_ACCOUNT_TYPES } from "@/lib/cash";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import { Button, Field, Input, Select } from "@/components/ui";

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
        <Field label="Name" htmlFor="cash-name">
          <Input
            id="cash-name"
            name="name"
            type="text"
            required
            defaultValue={initial?.name}
            placeholder="e.g. Cathay Savings"
          />
        </Field>
        <Field label="Type" htmlFor="cash-account-type">
          <Select
            id="cash-account-type"
            name="account_type"
            defaultValue={initial?.account_type ?? "checking"}
          >
            {CASH_ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Balance" htmlFor="cash-balance">
          <Input
            id="cash-balance"
            name="balance"
            type="number"
            step="0.01"
            required
            defaultValue={initial?.balance}
            placeholder="0.00"
          />
        </Field>
        <Field label="Currency" htmlFor="cash-currency">
          <Select
            id="cash-currency"
            name="currency"
            defaultValue={initial?.currency ?? "TWD"}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {state.error && (
        <p className="text-[length:var(--t-sm)] text-[var(--neg)]">{state.error}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        className="self-start disabled:opacity-50"
      >
        {pending ? "Saving…" : (submitLabel ?? "Add account")}
      </Button>
    </form>
  );
}
