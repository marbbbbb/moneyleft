import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCashAccount } from "../../actions";
import { CashForm } from "../../cash-form";
import { PageHeader } from "@/components/ui";

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-[var(--sp-6)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <PageHeader title="Edit account" />

      <CashForm
        action={updateCashAccount}
        initial={account as never}
        submitLabel="Save changes"
      />
    </main>
  );
}
