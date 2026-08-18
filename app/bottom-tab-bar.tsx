import Link from "next/link";

// Shared with app-shell.tsx so the bar's own height and the page content's
// bottom clearance can never drift out of sync.
export const TAB_BAR_HEIGHT = "64px";

type IconProps = { active: boolean };

function HomeIcon({ active }: IconProps) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3.2 3.4 11h2.1v8.3c0 .6.5 1.2 1.2 1.2H9v-6.5h6V20.5h2.3c.7 0 1.2-.6 1.2-1.2V11h2.1z" />
      </svg>
    );
  }
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.5V19a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-8.5" />
    </svg>
  );
}

function TransactionsIcon({ active }: IconProps) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="9" y="5" width="11" height="2.4" rx="1.2" />
        <rect x="9" y="10.8" width="11" height="2.4" rx="1.2" />
        <rect x="9" y="16.6" width="11" height="2.4" rx="1.2" />
        <circle cx="4.5" cy="6.2" r="1.5" />
        <circle cx="4.5" cy="12" r="1.5" />
        <circle cx="4.5" cy="17.8" r="1.5" />
      </svg>
    );
  }
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function NetWorthIcon({ active }: IconProps) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 12 L12 3.5 A8.5 8.5 0 0 1 20.21 14.2 Z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5V12l6 3.5" />
    </svg>
  );
}

function MoreIcon({ active }: IconProps) {
  const r = active ? 2 : 1.6;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r={r} />
      <circle cx="12" cy="12" r={r} />
      <circle cx="19" cy="12" r={r} />
    </svg>
  );
}

const TABS: {
  href: string;
  label: string;
  Icon: (props: IconProps) => React.ReactElement;
  match: (pathname: string) => boolean;
}[] = [
  {
    href: "/dashboard",
    label: "Home",
    Icon: HomeIcon,
    match: (p) => p === "/dashboard",
  },
  {
    href: "/transactions",
    label: "Transactions",
    Icon: TransactionsIcon,
    match: (p) => p === "/transactions" || p.startsWith("/transactions/"),
  },
  {
    href: "/",
    label: "Net worth",
    Icon: NetWorthIcon,
    match: (p) => p === "/",
  },
  {
    href: "/more",
    label: "More",
    Icon: MoreIcon,
    match: (p) =>
      ["/more", "/plan", "/cash", "/assets", "/liabilities", "/holdings", "/portfolio", "/reminders", "/settings"].some(
        (prefix) => p === prefix || p.startsWith(`${prefix}/`),
      ),
  },
];

export function BottomTabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="mx-auto flex w-full max-w-xl items-stretch justify-around"
        style={{ height: TAB_BAR_HEIGHT }}
      >
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-[var(--sp-1)] ${
                active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
              }`}
            >
              <tab.Icon active={active} />
              <span
                className={`text-[length:var(--t-xs)] ${active ? "font-semibold" : "font-normal"}`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
