// Liability (debt) types offered in the UI. Values must match the DB enum
// `liability_type`. Pure module — safe on client + server.
export const LIABILITY_TYPES = [
  { value: "mortgage", label: "Mortgage" },
  { value: "car_loan", label: "Car loan" },
  { value: "student_loan", label: "Student loan" },
  { value: "credit_card", label: "Credit card" },
  { value: "personal_loan", label: "Personal loan" },
  { value: "other", label: "Other" },
] as const;

export const LIABILITY_TYPE_VALUES = LIABILITY_TYPES.map((t) => t.value);

export function liabilityTypeLabel(value: string): string {
  return LIABILITY_TYPES.find((t) => t.value === value)?.label ?? value;
}
