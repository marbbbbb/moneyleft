"use client";

import { useActionState } from "react";
import { estimateValuation } from "../actions";

export function EstimateButton({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState(estimateValuation, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="asset_id" value={assetId} />
      <button
        disabled={pending}
        className="self-start rounded-md bg-black min-h-11 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Estimating…" : "Estimate current value"}
      </button>
      {pending && (
        <p className="text-xs text-gray-500">
          Fetching data and estimating — this can take a few seconds.
        </p>
      )}
      {state.error && (
        <p
          className={`text-sm ${
            state.limited
              ? "text-amber-700 dark:text-amber-500" // hit the daily cap — expected, not a failure
              : "text-red-600"
          }`}
        >
          {state.limited ? "⏳ " : ""}
          {state.error}
        </p>
      )}
      {state.ok &&
        (state.note ? (
          <p className="text-sm text-gray-500">{state.note}</p>
        ) : (
          <p className="text-sm text-green-600">New valuation saved below.</p>
        ))}
    </form>
  );
}
