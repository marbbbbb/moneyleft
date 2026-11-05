import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "outline";
type ButtonSize = "default" | "compact";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-fg)] border border-[var(--accent)]",
  secondary: "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]",
  danger: "bg-transparent text-[var(--neg)] border border-[var(--border)]",
  outline: "bg-transparent text-[var(--text-muted)] border border-[var(--border-strong)]",
};

// default meets the 44px tap target. compact is for small inline chips only
// (e.g. the portfolio per-holding currency chip), not for form actions.
const sizeClasses: Record<ButtonSize, string> = {
  default:
    "min-h-11 px-[var(--sp-3)] py-[var(--sp-2)] rounded-[var(--r-sm)] text-[length:var(--t-sm)] font-medium",
  compact: "px-2 py-0.5 rounded text-xs",
};

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
