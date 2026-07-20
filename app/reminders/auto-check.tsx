"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markAllRemindersRead, runSpendingCheck } from "../settings/actions";

type CheckState = {
  error?: string;
  ok?: boolean;
  note?: string;
  limited?: boolean;
};

// On landing here we: (1) auto-run the spending check so the user never has to
// click, (2) refresh to surface anything new, then (3) mark everything read so
// the nav badge clears. Runs once per mount (guarded against React's dev
// double-invoke).
export function AutoCheck() {
  const router = useRouter();
  const ran = useRef(false);
  const [status, setStatus] = useState<CheckState | null>(null);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const result = await runSpendingCheck();
        setStatus(result);
        // Show any newly-created reminders (still unread → highlighted).
        router.refresh();
        // Quiet the badge on every other page. This does not revalidate
        // /reminders, so the highlighted view from the refresh above stays.
        await markAllRemindersRead();
      } catch {
        setStatus({ error: "Couldn't refresh your reminders just now." });
      } finally {
        setRunning(false);
      }
    })();
  }, [router]);

  const message = running
    ? "Checking this month's spending…"
    : status?.limited
      ? `⏳ ${status.error}`
      : status?.error
        ? status.error
        : (status?.note ?? "Up to date.");

  return (
    <p
      className={`text-xs ${
        status?.limited
          ? "text-amber-700 dark:text-amber-500"
          : status?.error
            ? "text-red-600"
            : "text-gray-500"
      }`}
    >
      {message}
    </p>
  );
}
