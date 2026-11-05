"use client";

import { useActionState } from "react";
import { estimateValuation } from "../actions";
import { Button } from "@/components/ui";

export function EstimateButton({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState(estimateValuation, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="asset_id" value={assetId} />
      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        className="self-start disabled:opacity-50"
      >
        {pending ? "Estimating…" : "Estimate current value"}
      </Button>
      {pending && (
        <p className="text-xs text-[var(--text-muted)]">
          Fetching data and estimating — this can take a few seconds.
        </p>
      )}
      {state.error && (
        <p
          className={`text-sm ${
            state.limited
              ? "text-[var(--warn)]" // hit the daily cap — expected, not a failure
              : "text-[var(--neg)]"
          }`}
        >
          {state.limited ? "⏳ " : ""}
          {state.error}
        </p>
      )}
      {state.ok &&
        (state.note ? (
          <p className="text-sm text-[var(--text-muted)]">{state.note}</p>
        ) : (
          <p className="text-sm text-[var(--pos)]">New valuation saved below.</p>
        ))}
    </form>
  );
}
