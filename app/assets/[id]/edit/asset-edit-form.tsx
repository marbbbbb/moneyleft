"use client";

import { useActionState, useState } from "react";
import { updateAsset } from "../../actions";
import { ASSET_CATEGORIES } from "@/lib/assets";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900";

export type AssetEditInitial = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  currency: string;
  acquisition_cost: number | null;
  acquisition_date: string | null;
  details: {
    metal?: string;
    weight_grams?: number;
    purity?: number;
    mileage?: number;
  } | null;
};

export function AssetEditForm({ initial }: { initial: AssetEditInitial }) {
  const [state, action, pending] = useActionState(updateAsset, {});
  const [category, setCategory] = useState(initial.category);
  const details = initial.details ?? {};

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={initial.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input name="name" type="text" required defaultValue={initial.name} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            {ASSET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Currency
          <select name="currency" defaultValue={initial.currency} className={inputClass}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Purchase price
          <input
            name="purchase_price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={initial.acquisition_cost ?? undefined}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Purchase date
          <input
            name="purchase_date"
            type="date"
            required
            defaultValue={initial.acquisition_date ?? undefined}
            className={inputClass}
          />
        </label>
      </div>

      {category === "precious_metal" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Metal
            <select name="metal" defaultValue={details.metal ?? "gold"} className={inputClass}>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="platinum">Platinum</option>
              <option value="palladium">Palladium</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Weight (grams)
            <input
              name="weight_grams"
              type="number"
              step="any"
              min="0"
              defaultValue={details.weight_grams}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Purity
            <input
              name="purity"
              type="number"
              step="any"
              min="0"
              max="1"
              defaultValue={details.purity ?? 0.999}
              className={inputClass}
            />
          </label>
        </div>
      )}

      {category === "vehicle" && (
        <label className="flex flex-col gap-1 text-sm">
          Mileage (optional, km)
          <input
            name="mileage"
            type="number"
            step="any"
            min="0"
            defaultValue={details.mileage}
            className={inputClass}
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Details (optional)
        <textarea
          name="description"
          rows={3}
          defaultValue={initial.description ?? ""}
          className={inputClass}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
