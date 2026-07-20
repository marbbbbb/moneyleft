"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addAsset } from "./actions";
import { ASSET_CATEGORIES } from "@/lib/assets";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900";

export function AssetForm() {
  const [state, action, pending] = useActionState(addAsset, {});
  const formRef = useRef<HTMLFormElement>(null);
  // Drives which category-specific fields show (and are needed for estimation).
  const [category, setCategory] = useState("real_estate");

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
      setCategory("real_estate");
    }
  }, [pending, state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Rolex Submariner"
            className={inputClass}
          />
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
          <select name="currency" defaultValue="TWD" className={inputClass}>
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
            placeholder="what you paid"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Purchase date
          <input
            name="purchase_date"
            type="date"
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Current value
          <input
            name="value"
            type="number"
            step="0.01"
            min="0"
            placeholder="worth today"
            className={inputClass}
          />
          <span className="text-xs text-gray-500">
            leave blank to let AI estimate it
          </span>
        </label>
      </div>

      {category === "precious_metal" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Metal
            <select name="metal" defaultValue="gold" className={inputClass}>
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
              placeholder="e.g. 31.1"
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
              defaultValue="0.999"
              placeholder="0.999 (24k=1.0)"
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
            placeholder="e.g. 45000"
            className={inputClass}
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Details (optional)
        <textarea
          name="description"
          rows={3}
          placeholder="Anything you want to note — condition, serial number, address, etc."
          className={inputClass}
        />
      </label>

      <p className="text-xs text-gray-500">
        Purchase price is fixed history. Leave current value blank to add it
        later with <span className="font-medium">Estimate current value</span> on
        the asset&apos;s page. Manual values are recorded as a tight range at{" "}
        <span className="font-medium">high</span> confidence.
      </p>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending}
        className="self-start rounded-md bg-black min-h-11 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Adding…" : "Add asset"}
      </button>
    </form>
  );
}
