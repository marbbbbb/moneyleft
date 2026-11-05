"use client";

import { useActionState, useState } from "react";
import { updateAsset } from "../../actions";
import { ASSET_CATEGORIES } from "@/lib/assets";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

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
        <Field label="Name" htmlFor="asset-edit-name">
          <Input id="asset-edit-name" name="name" type="text" required defaultValue={initial.name} />
        </Field>
        <Field label="Category" htmlFor="asset-edit-category">
          <Select
            id="asset-edit-category"
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
        <Field label="Currency" htmlFor="asset-edit-currency">
          <Select id="asset-edit-currency" name="currency" defaultValue={initial.currency}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Purchase price" htmlFor="asset-edit-purchase-price">
          <Input
            id="asset-edit-purchase-price"
            name="purchase_price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={initial.acquisition_cost ?? undefined}
          />
        </Field>
        <Field label="Purchase date" htmlFor="asset-edit-purchase-date">
          <Input
            id="asset-edit-purchase-date"
            name="purchase_date"
            type="date"
            required
            defaultValue={initial.acquisition_date ?? undefined}
          />
        </Field>
      </div>

      {category === "precious_metal" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Metal" htmlFor="asset-edit-metal">
            <Select id="asset-edit-metal" name="metal" defaultValue={details.metal ?? "gold"}>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="platinum">Platinum</option>
              <option value="palladium">Palladium</option>
            </Select>
          </Field>
          <Field label="Weight (grams)" htmlFor="asset-edit-weight-grams">
            <Input
              id="asset-edit-weight-grams"
              name="weight_grams"
              type="number"
              step="any"
              min="0"
              defaultValue={details.weight_grams}
            />
          </Field>
          <Field label="Purity" htmlFor="asset-edit-purity">
            <Input
              id="asset-edit-purity"
              name="purity"
              type="number"
              step="any"
              min="0"
              max="1"
              defaultValue={details.purity ?? 0.999}
            />
          </Field>
        </div>
      )}

      {category === "vehicle" && (
        <Field label="Mileage (optional, km)" htmlFor="asset-edit-mileage">
          <Input
            id="asset-edit-mileage"
            name="mileage"
            type="number"
            step="any"
            min="0"
            defaultValue={details.mileage}
          />
        </Field>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Details (optional)
        <Textarea
          name="description"
          rows={3}
          defaultValue={initial.description ?? ""}
        />
      </label>

      {state.error && (
        <p className="text-[length:var(--t-sm)] text-[var(--neg)]">{state.error}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        className="self-start disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
