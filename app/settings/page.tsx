import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/login/actions";
import { CategoryMerge, type CategoryCount } from "./category-merge";
import { Button, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-[var(--sp-6)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <div>
        <PageHeader title="Settings" />
        <p className="text-[length:var(--t-sm)] text-[var(--text-muted)]">
          Tidy up your transaction categories.
        </p>
      </div>

      <section>
        <h2 className="mb-1 text-lg font-medium">Merge categories</h2>
        <CategoryMerge categories={categories} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-medium">Account</h2>
        <div className="flex items-center justify-between gap-[var(--sp-3)]">
          <div>
            <p className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
              Signed in as
            </p>
            <p className="text-[length:var(--t-sm)] text-[var(--text)]">
              {user?.email}
            </p>
          </div>
          <form action={signout}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
