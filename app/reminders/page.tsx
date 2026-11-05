import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { evaluateRules, type RuleEvaluation } from "@/lib/calculations/rules";
import { formatAmount } from "@/lib/rules";
import { AutoCheck } from "./auto-check";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  is_read: boolean;
  created_at: string;
};

export default async function RemindersPage() {
  const supabase = await createClient();

  let evaluations: RuleEvaluation[] = [];
  let evalError: string | null = null;
  try {
    evaluations = await evaluateRules(supabase);
  } catch (e) {
    evalError = e instanceof Error ? e.message : "Couldn't load your rules.";
  }

  const { data: notificationRows } = await supabase
    .from("notifications")
    .select("id, title, body, severity, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const notifications = (notificationRows ?? []) as Notification[];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <div>
        <PageHeader title="Reminders" />
        <p className="text-sm text-[var(--text-muted)]">
          Gentle nudges based on the rules you set.
        </p>
      </div>

      {/* Rule status — computed live, costs nothing */}
      <section>
        <h2 className="mb-3 text-lg font-medium">This month so far</h2>

        {evalError && <p className="text-sm text-[var(--neg)]">{evalError}</p>}

        {!evalError && evaluations.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">
            No rules yet —{" "}
            <Link href="/plan" className="underline">
              set a few in your plan
            </Link>
            .
          </p>
        )}

        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {evaluations.map((e) => (
            <li
              key={e.rule.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{e.label}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {e.skipped
                    ? e.skipped
                    : `${formatAmount(e.actual)} of ${formatAmount(e.target)}`}
                </span>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  e.skipped
                    ? "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    : e.broken
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                }`}
              >
                {e.skipped ? "not checked" : e.broken ? "over" : "within"}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <AutoCheck />
        </div>
      </section>

      {/* AI-written reminders */}
      <section>
        <h2 className="mb-3 text-lg font-medium">
          Your reminders ({notifications.length})
        </h2>

        {notifications.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nothing here yet. If something goes over one of your limits,
            a short note will show up here.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border p-4 ${
                  n.is_read
                    ? "border-[var(--border)] opacity-60"
                    : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{n.title}</span>
                    {n.body && (
                      <p className="text-sm text-[var(--text-muted)]">
                        {n.body}
                      </p>
                    )}
                    <span className="text-xs text-[var(--text-subtle)]">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {!n.is_read && (
                    <span
                      aria-hidden
                      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--neg)]"
                      title="New"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Reminders are observations based on rules you set — not financial
          advice.
        </p>
      </section>
    </main>
  );
}
