"use client";

import { useState } from "react";
import { Money } from "@/components/ui";
import type { CategoryDelta } from "@/lib/calculations/spending";

const SPENDING_CURRENCY = "TWD";

// Collapsed by default so the category breakdown doesn't compete with the
// hero figure. Same grid-rows + motion-reduce transition as
// app/transactions/add-transaction-panel.tsx, which itself mirrors the
// onboarding wizard's transition-[...] approach.
export function CategoryDisclosure({ byCategory }: { byCategory: CategoryDelta[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-[var(--sp-4)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="category-disclosure"
        className="flex w-full items-center justify-between rounded-[var(--r-sm)] py-[var(--sp-1)] text-[length:var(--t-sm)] text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
      >
        <span>By category</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-3 w-3 shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
            open ? "rotate-180" : "rotate-0"
          }`}
        >
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        id="category-disclosure"
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
          open ? "mt-[var(--sp-2)] grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div
          className={`overflow-hidden transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
            open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          }`}
          aria-hidden={!open}
        >
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {byCategory.slice(0, 5).map((c) => (
              <li
                key={c.category}
                className="flex items-center justify-between py-[var(--sp-2)] text-[length:var(--t-sm)]"
              >
                <span className="text-[var(--text)]">{c.category}</span>
                <span className="flex items-center gap-[var(--sp-3)]">
                  <Money amount={c.current} currency={SPENDING_CURRENCY} size="sm" />
                  <span
                    className={`flex items-center font-mono text-[var(--text)] ${
                      c.delta > 0
                        ? "[--text:var(--neg)]"
                        : c.delta < 0
                          ? "[--text:var(--pos)]"
                          : ""
                    }`}
                  >
                    {c.delta > 0 ? "+" : c.delta < 0 ? "-" : ""}
                    <Money
                      amount={Math.abs(c.delta)}
                      currency={SPENDING_CURRENCY}
                      size="sm"
                    />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
