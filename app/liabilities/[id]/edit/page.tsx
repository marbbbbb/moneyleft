import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateLiability } from "../../actions";
import { LiabilityForm } from "../../liability-form";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditLiabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: liability } = await supabase
    .from("liabilities")
    .select(
      "id, name, liability_type, balance, currency, interest_rate, kind, original_principal, term_months, start_date, anchor_balance, anchor_date",
    )
    .eq("id", id)
    .maybeSingle();

  if (!liability) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-[var(--sp-6)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <PageHeader title="Edit debt" />

      <LiabilityForm
        action={updateLiability}
        initial={liability as never}
        submitLabel="Save changes"
      />
    </main>
  );
}
