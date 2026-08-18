import { ReactNode } from "react";
import { Label } from "./Label";

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--neg)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
