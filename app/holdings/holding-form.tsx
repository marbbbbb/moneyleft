"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deriveCurrency, SUPPORTED_CURRENCIES } from "@/lib/tickers";
import { Button, Field, Input, Select } from "@/components/ui";

type FormState = { error?: string };
type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export type HoldingInitial = {
  id: string;
  ticker: string;
  shares: number;
  cost_basis: number;
  date_bought: string;
  currency: string;
};

export function HoldingForm({
  action,
  initial,
  submitLabel,
}: {
  action: FormAction;
  initial?: HoldingInitial;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(initial);

  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  // Editing starts with the stored currency "locked" so ticker edits don't stomp it.
  const [currencyTouched, setCurrencyTouched] = useState(isEdit);

  useEffect(() => {
    if (!isEdit && !pending && !state.error) {
      formRef.current?.reset();
      setTicker("");
      setCurrency("USD");
      setCurrencyTouched(false);
    }
  }, [pending, state, isEdit]);

  function onTickerChange(value: string) {
    setTicker(value);
    if (!currencyTouched) setCurrency(deriveCurrency(value));
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Ticker" htmlFor="holding-ticker">
          <Input
            id="holding-ticker"
            name="ticker"
            type="text"
            required
            placeholder="e.g. AAPL or 0056"
            value={ticker}
            onChange={(e) => onTickerChange(e.target.value)}
          />
        </Field>
        <Field label="Shares" htmlFor="holding-shares">
          <Input
            id="holding-shares"
            name="shares"
            type="number"
            step="any"
            required
            defaultValue={initial?.shares}
            placeholder="0"
          />
        </Field>
        <Field label="Cost basis (per share)" htmlFor="holding-cost-basis">
          <Input
            id="holding-cost-basis"
            name="cost_basis"
            type="number"
            step="0.01"
            required
            defaultValue={initial?.cost_basis}
            placeholder="0.00"
          />
        </Field>
        <Field label="Date bought" htmlFor="holding-date-bought">
          <Input
            id="holding-date-bought"
            name="date_bought"
            type="date"
            required
            defaultValue={initial?.date_bought}
          />
        </Field>
        <Field label="Currency" htmlFor="holding-currency">
          <Select
            id="holding-currency"
            name="currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              setCurrencyTouched(true);
            }}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
            {currencyTouched
              ? "Manually set"
              : `Auto-set from ticker (${deriveCurrency(ticker)})`}
          </p>
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
        {pending ? "Saving…" : (submitLabel ?? "Add holding")}
      </Button>
    </form>
  );
}
