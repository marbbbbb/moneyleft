"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addAsset } from "./actions";
import { ASSET_CATEGORIES } from "@/lib/assets";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import { Button, Field, Input, Select } from "@/components/ui";

// Only the <textarea> below still uses this: components/ui has no Textarea.
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
        <Field label="Name" htmlFor="asset-name">
          <Input
            id="asset-name"
            name="name"
            type="text"
            required
            placeholder="e.g. Rolex Submariner"
          />
        </Field>
        <Field label="Category" htmlFor="asset-category">
          <Select
            id="asset-category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {ASSET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency" htmlFor="asset-currency">
          <Select id="asset-currency" name="currency" defaultValue="TWD">
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Purchase price" htmlFor="asset-purchase-price">
          <Input
            id="asset-purchase-price"
            name="purchase_price"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="what you paid"
          />
        </Field>
        <Field label="Purchase date" htmlFor="asset-purchase-date">
          <Input
            id="asset-purchase-date"
            name="purchase_date"
            type="date"
            required
          />
        </Field>
        <Field label="Current value" htmlFor="asset-value">
          <Input
            id="asset-value"
            name="value"
            type="number"
            step="0.01"
            min="0"
            placeholder="worth today"
          />
          <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
            leave blank to let AI estimate it
          </p>
        </Field>
      </div>

      {category === "precious_metal" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Metal" htmlFor="asset-metal">
            <Select id="asset-metal" name="metal" defaultValue="gold">
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="platinum">Platinum</option>
              <option value="palladium">Palladium</option>
            </Select>
          </Field>
          <Field label="Weight (grams)" htmlFor="asset-weight-grams">
            <Input
              id="asset-weight-grams"
              name="weight_grams"
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 31.1"
            />
          </Field>
          <Field label="Purity" htmlFor="asset-purity">
            <Input
              id="asset-purity"
              name="purity"
              type="number"
              step="any"
              min="0"
              max="1"
              defaultValue="0.999"
              placeholder="0.999 (24k=1.0)"
            />
          </Field>
        </div>
      )}

      {category === "vehicle" && (
        <Field label="Mileage (optional, km)" htmlFor="asset-mileage">
          <Input
            id="asset-mileage"
            name="mileage"
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 45000"
          />
        </Field>
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

      <p className="text-xs text-[var(--text-muted)]">
        Purchase price is fixed history. Leave current value blank to add it
        later with <span className="font-medium">Estimate current value</span> on
        the asset&apos;s page. Manual values are recorded as a tight range at{" "}
        <span className="font-medium">high</span> confidence.
      </p>

      {state.error && (
        <p className="text-[length:var(--t-sm)] text-[var(--neg)]">{state.error}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        className="self-start disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add asset"}
      </Button>
    </form>
  );
}
