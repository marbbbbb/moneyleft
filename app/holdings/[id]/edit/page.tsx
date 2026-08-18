import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateHolding } from "../../actions";
import { HoldingForm } from "../../holding-form";

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Edit holding</h1>
      </header>

      <HoldingForm
        action={updateHolding}
        initial={holding as never}
        submitLabel="Save changes"
      />
    </main>
  );
}
