import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssetEditForm } from "./asset-edit-form";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("id, name, category, description, currency, acquisition_cost, acquisition_date, details")
    .eq("id", id)
    .maybeSingle();

  if (!asset) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-[var(--sp-6)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <PageHeader title="Edit asset" />

      <AssetEditForm initial={asset as never} />
    </main>
  );
}
