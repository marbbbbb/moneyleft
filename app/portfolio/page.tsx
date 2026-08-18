import { createClient } from "@/lib/supabase/server";
import { computePortfolio, type Portfolio } from "@/lib/calculations/portfolio";
import { PortfolioView } from "./portfolio-view";

// Live prices — don't prerender; fetch fresh (the provider layer caches quotes).
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const supabase = await createClient();

  let portfolio: Portfolio | null = null;
  let loadError: string | null = null;
  try {
    portfolio = await computePortfolio(supabase);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load portfolio.";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Portfolio</h1>
      </header>

      {loadError && (
        <p className="text-sm text-red-600">
          {loadError}
          <br />
          <span className="text-gray-500">
            If this mentions a missing column, run{" "}
            <code>supabase/002_networth_schema.sql</code> (it adds{" "}
            <code>currency</code> to holdings).
          </span>
        </p>
      )}

      {portfolio && <PortfolioView portfolio={portfolio} />}
    </main>
  );
}
