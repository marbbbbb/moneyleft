import { loadRulesDefaults } from "../settings/defaults";
import { RulesForm } from "../settings/rules-form";

export const dynamic = "force-dynamic";

// First-run experience. Same form as /settings, wrapped in a welcome. Home
// redirects here until onboarding_completed_at is set.
export default async function OnboardingPage() {
  const { defaults } = await loadRulesDefaults();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Welcome — let&apos;s set a few rules</h1>
        <p className="mt-2 text-sm text-gray-500">
          A handful of quick questions so the app can gently keep an eye on things
          for you. There are no wrong answers, nothing here is a commitment, and
          you can change or skip any of it later.
        </p>
      </header>

      <RulesForm defaults={defaults} />
    </main>
  );
}
