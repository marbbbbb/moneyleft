import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateHolding } from "../../actions";
import { HoldingForm } from "../../holding-form";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditHoldingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: holding } = await supabase
    .from("holdings")
    .select("id, ticker, shares, cost_basis, date_bought, currency")
    .eq("id", id)
    .maybeSingle();

  if (!holding) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-[var(--sp-6)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <PageHeader title="Edit holding" />

      <HoldingForm
        action={updateHolding}
        initial={holding as never}
        submitLabel="Save changes"
      />
    </main>
  );
}
