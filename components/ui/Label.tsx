import { LabelHTMLAttributes } from "react";

export function Label({
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`block text-[length:var(--t-sm)] text-[var(--text-muted)] mb-[var(--sp-1)] ${className}`}
      {...props}
    />
  );
}
