// Pure amortization math for liabilities whose balance is DERIVED from loan
// terms rather than stored by hand. No imports from Supabase or React, and no
// side effects — every function here is a plain calculation over its inputs.
//
// `kind` decides which of the two models applies:
//   'simple'     — the stored `balance` is authoritative; nothing is computed.
//   'amortizing' — `balance` is ignored in favor of a standard fixed-rate
//                  amortization schedule derived from the loan's terms.

/**
 * Minimal structural shape this module needs — deliberately not the DB row
 * type, to avoid a circular dependency between this module and the pages that
 * both produce DB rows and consume this module. Any object with at least
 * these fields (e.g. a Supabase row with extra columns) satisfies it.
 */
export type LiabilityLike = {
  kind: string;
  balance: number;
  interest_rate: number | null;
  original_principal: number | null;
  term_months: number | null;
  start_date: string | null; // 'YYYY-MM-DD'
  monthly_payment: number | null;
  anchor_balance: number | null;
  anchor_date: string | null; // 'YYYY-MM-DD'
};

/** The fixed monthly payment for a standard amortizing loan. */
export function monthlyPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/** Remaining balance after `monthsElapsed` fixed payments. Never negative. */
export function balanceAfterPayments(
  principal: number,
  annualRatePct: number,
  payment: number,
  monthsElapsed: number,
): number {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.max(0, principal - payment * monthsElapsed);
  const g = Math.pow(1 + r, monthsElapsed);
  return Math.max(0, principal * g - (payment * (g - 1)) / r);
}

// A DATE-only column ('YYYY-MM-DD') parsed as UTC midnight, so calendar-month
// math never drifts a day depending on the server/browser's local timezone —
// the same class of bug this app hit earlier with future-dated valuations.
function parseDateUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

// Whole calendar months between two dates, via UTC fields throughout so the
// result doesn't depend on either date's local timezone offset. A partial
// month (the day-of-month in `to` hasn't reached the day-of-month in `from`
// yet) does not count.
function wholeMonthsBetween(from: Date, to: Date): number {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

/**
 * Resolves the starting point and elapsed-months count shared by
 * `currentBalance` and `amortizationProgress`, so that logic exists exactly
 * once. Returns null when the liability isn't amortizing, or is amortizing
 * but missing the loan terms it needs (e.g. `kind` was flipped without the
 * required fields) — callers fall back to the stored balance in that case.
 */
function resolveSchedule(
  liability: LiabilityLike,
  asOf: Date,
): {
  startPrincipal: number;
  rate: number;
  payment: number;
  monthsElapsed: number;
  termMonths: number;
} | null {
  if (liability.kind !== "amortizing") return null;

  const { original_principal, term_months, start_date } = liability;
  if (original_principal == null || term_months == null || !start_date) {
    return null;
  }

  const rate = liability.interest_rate ?? 0;

  // A "correct the balance" anchor (see the Edit form) overrides the STARTING
  // point only — the monthly payment is always derived from the original loan
  // terms, since correcting drift doesn't change what you agreed to pay.
  const hasAnchor =
    liability.anchor_balance != null && liability.anchor_date != null;
  const startPrincipal = hasAnchor ? liability.anchor_balance! : original_principal;
  const startDateStr = hasAnchor ? liability.anchor_date! : start_date;

  const monthsElapsed = Math.min(
    Math.max(0, wholeMonthsBetween(parseDateUTC(startDateStr), asOf)),
    term_months,
  );

  const payment =
    liability.monthly_payment ?? monthlyPayment(original_principal, rate, term_months);

  return { startPrincipal, rate, payment, monthsElapsed, termMonths: term_months };
}

/**
 * The current balance of a liability as of `asOf`.
 *
 * For kind !== 'amortizing', this is just the stored balance, unchanged.
 * For 'amortizing', the balance is derived from the loan's terms — see
 * `resolveSchedule` for how the starting point and elapsed months are picked.
 */
export function currentBalance(liability: LiabilityLike, asOf: Date): number {
  const schedule = resolveSchedule(liability, asOf);
  if (!schedule) return liability.balance;

  const balance = balanceAfterPayments(
    schedule.startPrincipal,
    schedule.rate,
    schedule.payment,
    schedule.monthsElapsed,
  );
  return Math.round(balance * 100) / 100;
}

/**
 * Payment progress for display (e.g. "24 of 240 payments made"). Not part of
 * the balance calculation itself — exposed so the liabilities list can show
 * progress without reimplementing the elapsed-months logic above. Returns
 * null under the same conditions `currentBalance` falls back to the stored
 * balance (not amortizing, or missing required loan terms).
 */
export function amortizationProgress(
  liability: LiabilityLike,
  asOf: Date,
): { monthsElapsed: number; termMonths: number } | null {
  const schedule = resolveSchedule(liability, asOf);
  if (!schedule) return null;
  return { monthsElapsed: schedule.monthsElapsed, termMonths: schedule.termMonths };
}
