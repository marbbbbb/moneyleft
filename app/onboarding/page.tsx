import { redirect } from "next/navigation";
import { loadRulesDefaults } from "../settings/defaults";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";

// First-run experience: a one-question-per-screen wizard (onboarding-wizard.tsx)
// over the same save action /settings uses. Dashboard redirects here until
// onboarding_completed_at is set; the wizard's own welcome step replaces what
// used to be static copy here.
export default async function OnboardingPage() {
  const { defaults, completed } = await loadRulesDefaults();

  // Already done this once — don't make a returning user sit through it again.
  if (completed) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <OnboardingWizard defaults={defaults} />
    </main>
  );
}
