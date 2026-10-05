"use client";

import { useActionState, useEffect, useRef } from "react";
import { addValuation } from "../actions";
import { CONFIDENCE_LEVELS } from "@/lib/assets";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import { Button, Field, Input, Select } from "@/components/ui";

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
        <Field label="Range low" htmlFor="valuation-value-low">
          <Input
            id="valuation-value-low"
            name="value_low"
            type="number"
            step="0.01"
            min="0"
            required
          />
        </Field>
        <Field label="Range high" htmlFor="valuation-value-high">
          <Input
            id="valuation-value-high"
            name="value_high"
            type="number"
            step="0.01"
            min="0"
            required
          />
        </Field>
        <Field label="Confidence" htmlFor="valuation-confidence">
          <Select id="valuation-confidence" name="confidence" defaultValue="high">
            {CONFIDENCE_LEVELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency" htmlFor="valuation-currency">
          <Select
            id="valuation-currency"
            name="currency"
            defaultValue={defaultCurrency}
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
        {pending ? "Saving…" : "Add valuation"}
      </Button>
    </form>
  );
}
