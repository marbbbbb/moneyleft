import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { RemindersNavLink } from "../reminders-nav-link";

const MORE_LINKS = [
  { href: "/plan", label: "Plan" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/settings", label: "Settings" },
];

function Arrow() {
  return (
    <span className="text-[var(--text-subtle)]" aria-hidden="true">
      →
    </span>
  );
}

export default function MorePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-[var(--sp-4)] p-[var(--sp-4)] sm:p-[var(--sp-6)]">
      <PageHeader title="More" />

      <div className="flex flex-col gap-[var(--sp-3)]">
        {/* Reminders keeps its own unread-badge component, so this row isn't
            wrapped in an outer Link (that would nest an <a> inside an <a>). */}
        <Card className="flex items-center justify-between">
          <RemindersNavLink className="text-[length:var(--t-base)] font-medium text-[var(--text)]" />
          <Arrow />
        </Card>

        {MORE_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="block">
            <Card className="flex items-center justify-between">
              <span className="text-[length:var(--t-base)] font-medium text-[var(--text)]">
                {link.label}
              </span>
              <Arrow />
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
