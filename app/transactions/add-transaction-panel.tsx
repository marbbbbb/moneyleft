"use client";

import { useState, type ComponentProps } from "react";
import { Button, Card } from "@/components/ui";
import { TransactionForm } from "./transaction-form";

// Collapsed by default so the ledger — not the occasional "add" action —
// is what greets the user. The form stays mounted at all times (just
// visually hidden via CSS) so in-progress input survives a close, and the
// height/opacity transition below mirrors the onboarding wizard's
// transition-[...] + motion-reduce approach in app/onboarding/onboarding-wizard.tsx.
export function AddTransactionPanel({
  action,
  categories,
}: {
  action: ComponentProps<typeof TransactionForm>["action"];
  categories: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="add-transaction-panel"
      >
        {open ? "Close" : "+ Add a transaction"}
      </Button>

      <div
        id="add-transaction-panel"
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
          open ? "mt-[var(--sp-4)] grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div
          className={`overflow-hidden transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
            open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          }`}
          aria-hidden={!open}
        >
          <Card>
            <h2 className="mb-[var(--sp-3)] text-[length:var(--t-base)] font-medium text-[var(--text)]">
              Add a transaction
            </h2>
            <TransactionForm
              action={action}
              categories={categories}
              onSuccess={() => setOpen(false)}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
