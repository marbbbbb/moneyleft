import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateLiability } from "../../actions";
import { LiabilityForm } from "../../liability-form";

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Edit debt</h1>
      </header>

      <LiabilityForm
        action={updateLiability}
        initial={liability as never}
        submitLabel="Save changes"
      />
    </main>
  );
}
