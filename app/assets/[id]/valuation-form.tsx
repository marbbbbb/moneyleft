"use client";

import { useActionState, useEffect, useRef } from "react";
import { addValuation } from "../actions";
import { CONFIDENCE_LEVELS } from "@/lib/assets";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900";

// Lets you record a wider estimated range at a chosen confidence — the same
// shape an AI estimate will later produce.
export function ValuationForm({
  assetId,
  defaultCurrency,
}: {
  assetId: string;
  defaultCurrency: string;
}) {
  const [state, action, pending] = useActionState(addValuation, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="asset_id" value={assetId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Range low
          <input
            name="value_low"
            type="number"
            step="0.01"
            min="0"
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Range high
          <input
            name="value_high"
            type="number"
            step="0.01"
            min="0"
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Confidence
          <select name="confidence" defaultValue="high" className={inputClass}>
            {CONFIDENCE_LEVELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Currency
          <select
            name="currency"
            defaultValue={defaultCurrency}
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
        className="self-start rounded-md bg-black min-h-11 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Add valuation"}
      </button>
    </form>
  );
}
