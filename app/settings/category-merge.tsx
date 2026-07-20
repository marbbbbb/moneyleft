"use client";

import { useActionState, useState } from "react";
import { mergeCategories } from "./actions";

export type CategoryCount = { category: string; count: number };

export function CategoryMerge({ categories }: { categories: CategoryCount[] }) {
  const [state, action, pending] = useActionState(mergeCategories, {});
  const [target, setTarget] = useState("");

  if (categories.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No categories yet — they&apos;ll appear here once you add transactions.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm text-gray-500">
        Tick the duplicates to combine, then choose the spelling to keep. Every
        matching transaction (and any category limit) is rewritten.
      </p>

      <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
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
              <span className="text-gray-400">{c.count}</span>
            </label>
            <button
              type="button"
              onClick={() => setTarget(c.category)}
              className="text-xs text-gray-500 hover:underline"
            >
              keep this
            </button>
          </li>
        ))}
      </ul>

      <label className="flex flex-col gap-1 text-sm">
        Merge into (keep this spelling)
        <input
          name="target"
          type="text"
          list="merge-target-list"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="e.g. Dining"
          className="rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900"
        />
        <datalist id="merge-target-list">
          {categories.map((c) => (
            <option key={c.category} value={c.category} />
          ))}
        </datalist>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && state.note && (
        <p className="text-sm text-green-600">{state.note}</p>
      )}

      <button
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Merging…" : "Merge selected"}
      </button>
    </form>
  );
}
