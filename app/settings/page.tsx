import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadRulesDefaults } from "./defaults";
import { RulesForm } from "./rules-form";
import { CategoryMerge, type CategoryCount } from "./category-merge";
import { RemindersNavLink } from "../reminders-nav-link";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { defaults } = await loadRulesDefaults();

  // Exact-string category counts (case-sensitive) so duplicates are visible.
  const { data: catRows } = await supabase.from("transactions").select("category");
  const counts = new Map<string, number>();
  for (const r of catRows ?? []) {
    const c = String((r as { category: string }).category ?? "").trim();
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const categories: CategoryCount[] = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-gray-500">
            Update your rules and tidy up categories.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/" className="underline">
            Net worth
          </Link>
          <RemindersNavLink className="underline" />
        </nav>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-medium">Spending rules</h2>
        <RulesForm defaults={defaults} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-medium">Merge categories</h2>
        <CategoryMerge categories={categories} />
      </section>
    </main>
  );
}
