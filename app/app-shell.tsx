"use client";

import { usePathname } from "next/navigation";
import { BottomTabBar, TAB_BAR_HEIGHT } from "./bottom-tab-bar";

// Single source of truth for "does this route get the app chrome" — both the
// bar's visibility and the content's bottom clearance read this same check,
// so they can never disagree.
const NO_CHROME_PREFIXES = ["/login", "/onboarding"];

function isChromeHidden(pathname: string): boolean {
  return NO_CHROME_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isChromeHidden(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        style={{ paddingBottom: `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))` }}
      >
        {children}
      </div>
      <BottomTabBar pathname={pathname} />
    </>
  );
}
