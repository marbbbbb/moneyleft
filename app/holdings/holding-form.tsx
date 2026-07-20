"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deriveCurrency, SUPPORTED_CURRENCIES } from "@/lib/tickers";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900";

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
        <label className="flex flex-col gap-1 text-sm">
          Ticker
          <input
            name="ticker"
            type="text"
            required
            placeholder="e.g. AAPL or 0056"
            value={ticker}
            onChange={(e) => onTickerChange(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Shares
          <input
            name="shares"
            type="number"
            step="any"
            required
            defaultValue={initial?.shares}
            placeholder="0"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Cost basis (per share)
          <input
            name="cost_basis"
            type="number"
            step="0.01"
            required
            defaultValue={initial?.cost_basis}
            placeholder="0.00"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date bought
          <input
            name="date_bought"
            type="date"
            required
            defaultValue={initial?.date_bought}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Currency
          <select
            name="currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              setCurrencyTouched(true);
            }}
            className={inputClass}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            {currencyTouched
              ? "Manually set"
              : `Auto-set from ticker (${deriveCurrency(ticker)})`}
          </span>
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : (submitLabel ?? "Add holding")}
      </button>
    </form>
  );
}
