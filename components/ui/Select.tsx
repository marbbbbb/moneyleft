import { SelectHTMLAttributes } from "react";

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--r-sm)] px-[var(--sp-3)] py-[var(--sp-2)] text-[length:var(--t-base)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
