import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-fg)] border border-[var(--accent)]",
  secondary: "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]",
  danger: "bg-transparent text-[var(--neg)] border border-[var(--border)]",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`px-[var(--sp-3)] py-[var(--sp-2)] rounded-[var(--r-sm)] text-[length:var(--t-sm)] font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
