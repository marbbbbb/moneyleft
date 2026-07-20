import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateTransaction } from "../../actions";
import { TransactionForm } from "../../transaction-form";

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
    .select("id, date, amount, category, note, type")
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Edit transaction</h1>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/transactions" className="underline">
            Back to transactions
          </Link>
        </nav>
      </header>

      <TransactionForm
        action={updateTransaction}
        categories={categories}
        initial={tx as never}
        submitLabel="Save changes"
      />
    </main>
  );
}
