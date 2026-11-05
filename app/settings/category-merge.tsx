"use client";

import { useActionState, useState } from "react";
import { mergeCategories } from "./actions";
import { Button, Field, Input } from "@/components/ui";

export type CategoryCount = { category: string; count: number };

export function CategoryMerge({ categories }: { categories: CategoryCount[] }) {
  const [state, action, pending] = useActionState(mergeCategories, {});
  const [target, setTarget] = useState("");

  if (categories.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No categories yet — they&apos;ll appear here once you add transactions.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm text-[var(--text-muted)]">
        Tick the duplicates to combine, then choose the spelling to keep. Every
        matching transaction (and any category limit) is rewritten.
      </p>

      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {categories.map((c) => (
          <li key={c.category} className="flex items-center gap-3 py-2 text-sm">
            <input
              type="checkbox"
              name="sources"
              value={c.category}
              id={`cat-${c.category}`}
              className="h-4 w-4"
            />
            <label htmlFor={`cat-${c.category}`} className="flex flex-1 justify-between">
              <span>{c.category}</span>
              <span className="text-[var(--text-subtle)]">{c.count}</span>
            </label>
            <button
              type="button"
              onClick={() => setTarget(c.category)}
              className="text-xs text-[var(--text-muted)] hover:underline"
            >
              keep this
            </button>
          </li>
        ))}
      </ul>

      <Field label="Merge into (keep this spelling)" htmlFor="merge-target">
        <Input
          id="merge-target"
          name="target"
          type="text"
          list="merge-target-list"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="e.g. Dining"
        />
        <datalist id="merge-target-list">
          {categories.map((c) => (
            <option key={c.category} value={c.category} />
          ))}
        </datalist>
      </Field>

      {state.error && (
        <p className="text-[length:var(--t-sm)] text-[var(--neg)]">{state.error}</p>
      )}
      {state.ok && state.note && (
        <p className="text-[length:var(--t-sm)] text-[var(--pos)]">{state.note}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        className="self-start disabled:opacity-50"
      >
        {pending ? "Merging…" : "Merge selected"}
      </Button>
    </form>
  );
}
