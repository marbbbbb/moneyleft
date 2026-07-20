import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssetEditForm } from "./asset-edit-form";

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Edit asset</h1>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={`/assets/${id}`} className="underline">
            Back to asset
          </Link>
        </nav>
      </header>

      <AssetEditForm initial={asset as never} />
    </main>
  );
}
