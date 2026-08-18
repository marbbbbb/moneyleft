import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  nav?: ReactNode;
}

export function PageHeader({ title, nav }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-[var(--sp-4)] py-[var(--sp-4)]">
      <h1 className="text-[length:var(--t-lg)] font-medium text-[var(--text)]">
        {title}
      </h1>
      {nav ? <div className="flex items-center gap-[var(--sp-2)]">{nav}</div> : null}
    </div>
  );
}
