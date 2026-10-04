import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// The "Reminders" nav link with a quiet unread-count badge. RLS scopes the
// count to the signed-in user. Rendered server-side wherever the link appears.
export async function RemindersNavLink({
  className = "",
}: {
  className?: string;
}) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  const unread = count ?? 0;

  return (
    <Link
      href="/reminders"
      className={`relative inline-flex items-center gap-1.5 ${className}`}
    >
      Reminders
      {unread > 0 && (
        <span
          aria-label={`${unread} unread reminder${unread === 1 ? "" : "s"}`}
          className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--neg)] px-1 text-[length:var(--t-xs)] font-semibold leading-none text-[var(--accent-fg)]"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
