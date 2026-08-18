import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCashAccount } from "../../actions";
import { CashForm } from "../../cash-form";

export const dynamic = "force-dynamic";

export default async function EditCashPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("cash_accounts")
    .select("id, name, account_type, balance, currency")
    .eq("id", id)
    .maybeSingle();

  if (!account) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Edit account</h1>
      </header>

      <CashForm
        action={updateCashAccount}
        initial={account as never}
        submitLabel="Save changes"
      />
    </main>
  );
}
