import { loadRulesDefaults } from "../settings/defaults";
import { RulesForm } from "../settings/rules-form";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const { defaults } = await loadRulesDefaults();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-[var(--sp-6)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <div>
        <PageHeader title="Your plan" />
        <p className="text-[length:var(--t-sm)] text-[var(--text-muted)]">
          What you are aiming for each month.
        </p>
      </div>

      <RulesForm defaults={defaults} />
    </main>
  );
}
