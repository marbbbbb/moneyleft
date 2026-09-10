import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { addTransaction } from "../actions";
import { ReceiptScanner } from "./receipt-scanner";

export const dynamic = "force-dynamic";

// Distinct categories the user already uses - same derivation as
// app/transactions/page.tsx and the edit page, for the review sheet's
// datalist + "did you mean" helper.
export default async function ScanReceiptPage() {
  const supabase = await createClient();
  const { data: catRows } = await supabase.from("transactions").select("category");
  const categories = [
    ...new Map(
      (catRows ?? [])
        .map((r) => String((r as { category: string }).category ?? "").trim())
        .filter(Boolean)
        .map((c) => [c.toLowerCase(), c]),
    ).values(),
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-[var(--sp-6)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <PageHeader
        title="Scan receipt"
        nav={
          <Link
            href="/transactions"
            className="text-[length:var(--t-sm)] text-[var(--text-muted)] underline"
          >
            Cancel
          </Link>
        }
      />
      <ReceiptScanner action={addTransaction} categories={categories} />
    </main>
  );
}
