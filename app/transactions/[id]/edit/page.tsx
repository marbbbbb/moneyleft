import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateTransaction } from "../../actions";
import { TransactionForm } from "../../transaction-form";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, date, amount, category, note, type, currency")
    .eq("id", id)
    .maybeSingle();

  if (!tx) notFound();

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
      <PageHeader title="Edit transaction" />

      <TransactionForm
        action={updateTransaction}
        categories={categories}
        initial={tx as never}
        submitLabel="Save changes"
      />
    </main>
  );
}
