import { ButtonHTMLAttributes } from "react";
import Link from "next/link";

type TextButtonTone = "muted" | "danger";
type TextButtonSize = "sm" | "xs";

interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: TextButtonTone;
  size?: TextButtonSize;
  // When set, renders a Link instead of a <button> (e.g. "Edit").
  href?: string;
}

const toneClasses: Record<TextButtonTone, string> = {
  muted: "text-[var(--text-muted)]",
  danger: "text-[var(--neg)]",
};

const sizeClasses: Record<TextButtonSize, string> = {
  sm: "text-sm",
  xs: "text-xs",
};

// Quiet inline action (Edit / Delete / Remove) with a 44px tap target.
export function TextButton({
  tone = "muted",
  size = "sm",
  href,
  className = "",
  children,
  ...props
}: TextButtonProps) {
  const classes = `min-h-11 px-1 ${sizeClasses[size]} ${toneClasses[tone]} hover:underline ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
