"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { LIABILITY_TYPES } from "@/lib/liabilities";
import { SUPPORTED_CURRENCIES } from "@/lib/tickers";
import { currentBalance } from "@/lib/amortization";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900";

type FormState = { error?: string };
type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export type LiabilityInitial = {
  id: string;
  name: string;
  liability_type: string;
  balance: number;
  currency: string;
  interest_rate: number | null;
  kind: string;
  original_principal: number | null;
  term_months: number | null;
  start_date: string | null;
  anchor_balance: number | null;
  anchor_date: string | null;
};

// liability_type (what the debt IS) is independent of kind (how the balance
// BEHAVES) at the database level — nothing here is enforced on save. This is
// a form-only convenience: picking a type suggests a sensible starting kind,
// but the user's own toggle choice always wins once they've touched it.
const SUGGESTED_KIND: Record<string, "simple" | "amortizing"> = {
  mortgage: "amortizing",
  car_loan: "amortizing",
  student_loan: "amortizing",
  credit_card: "simple",
  personal_loan: "simple",
  other: "simple",
};

// Every text/number/date input below is fully controlled with state typed as
// `string`, defaulting to "" — never undefined, never null, never a number.
// This matters beyond any single field: the "Current balance" (simple) and
// "Original amount" (loan) inputs sit at the SAME position in the JSX tree
// across the kind toggle, so React reconciles them as the same underlying DOM
// node. If one side were controlled and the other uncontrolled, toggling kind
// would flip that node between the two — exactly the "changing an
// uncontrolled input to be controlled" warning (and its reverse). Keeping
// every field controlled with an always-defined string closes that off
// regardless of how React happens to diff the two branches.
function toStr(n: number | null | undefined): string {
  return n != null ? String(n) : "";
}

function money(n: number, currency: string): string {
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function LiabilityForm({
  action,
  initial,
  submitLabel,
}: {
  action: FormAction;
  initial?: LiabilityInitial;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(initial);

  const [nameValue, setNameValue] = useState(initial?.name ?? "");
  const [liabilityType, setLiabilityType] = useState(
    initial?.liability_type ?? "mortgage",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "TWD");

  // Default to Simple on a fresh Add form. On Edit, start from the stored
  // kind — an existing row's kind is already a deliberate choice and should
  // not be silently reclassified just because the user edits the type/name.
  const [kind, setKind] = useState<"simple" | "amortizing">(
    initial?.kind === "amortizing" ? "amortizing" : "simple",
  );
  // Whether the user has explicitly clicked the kind toggle this session.
  // Starts true on Edit (protects the stored kind) and false on Add (lets the
  // liability_type preselection apply until overridden).
  const [kindTouched, setKindTouched] = useState(isEdit);

  function onLiabilityTypeChange(value: string) {
    setLiabilityType(value);
    if (!kindTouched) {
      setKind(SUGGESTED_KIND[value] ?? "simple");
    }
  }

  function chooseKind(k: "simple" | "amortizing") {
    setKind(k);
    setKindTouched(true);
    setClientError(null);
  }

  // Simple-mode balance. Its own state, distinct from original_principal —
  // "current amount owed" and "what you originally borrowed" are different
  // numbers, not two views of the same field.
  const [balance, setBalance] = useState(toStr(initial?.balance));

  // interest_rate is the SAME underlying column (and the same `name=` on
  // submit) in both modes — one shared state, not two, so a value typed in
  // one mode isn't silently lost if the user toggles kind and back.
  const [interestRate, setInterestRate] = useState(toStr(initial?.interest_rate));

  const [originalPrincipal, setOriginalPrincipal] = useState(
    toStr(initial?.original_principal),
  );
  const [termYears, setTermYears] = useState(
    initial?.term_months != null ? String(initial.term_months / 12) : "",
  );
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");

  const [anchorBalance, setAnchorBalance] = useState(toStr(initial?.anchor_balance));
  const [anchorDate, setAnchorDate] = useState(initial?.anchor_date ?? "");

  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    // formRef.reset() is a no-op now that every field below is controlled
    // (React re-asserts each `value` on the next render regardless) — kept
    // for parity with the rest of the app's forms, but the real reset is the
    // explicit setState calls: every controlled field must be cleared here or
    // it silently survives a successful add.
    if (!isEdit && !pending && !state.error) {
      formRef.current?.reset();
      setNameValue("");
      setLiabilityType("mortgage");
      setCurrency("TWD");
      setKind("simple");
      setKindTouched(false);
      setBalance("");
      setInterestRate("");
      setOriginalPrincipal("");
      setTermYears("");
      setStartDate("");
      setAnchorBalance("");
      setAnchorDate("");
      setClientError(null);
    }
  }, [pending, state, isEdit]);

  const originalPrincipalNum = Number(originalPrincipal);
  const interestRateNum = Number(interestRate);
  const termYearsNum = Number(termYears);
  const termMonthsNum = Math.round(termYearsNum * 12);

  const previewValid =
    Number.isFinite(originalPrincipalNum) &&
    originalPrincipalNum > 0 &&
    Number.isFinite(interestRateNum) &&
    interestRateNum >= 0 &&
    Number.isFinite(termYearsNum) &&
    termYearsNum > 0 &&
    startDate !== "";

  const previewBalance = previewValid
    ? currentBalance(
        {
          kind: "amortizing",
          balance: 0,
          interest_rate: interestRateNum,
          original_principal: originalPrincipalNum,
          term_months: termMonthsNum,
          start_date: startDate,
          monthly_payment: null,
          anchor_balance: null,
          anchor_date: null,
        },
        new Date(),
      )
    : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (kind !== "amortizing") return; // simple mode: server-side check only

    if (!Number.isFinite(originalPrincipalNum) || originalPrincipalNum <= 0) {
      e.preventDefault();
      setClientError("Original amount must be a positive number.");
      return;
    }
    if (!Number.isFinite(termYearsNum) || termYearsNum <= 0) {
      e.preventDefault();
      setClientError("Term must be a positive number of years.");
      return;
    }
    if (!startDate) {
      e.preventDefault();
      setClientError("Start date is required for a loan.");
      return;
    }
    if (!Number.isFinite(interestRateNum) || interestRateNum < 0) {
      e.preventDefault();
      setClientError("Interest rate must be a non-negative number (0 is fine).");
      return;
    }
    setClientError(null);
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="kind" value={kind} />

      {/* Kind toggle — how the balance behaves, independent of liability_type */}
      <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm dark:border-gray-700">
        <button
          type="button"
          onClick={() => chooseKind("amortizing")}
          className={`min-h-11 flex-1 px-3 py-2 ${
            kind === "amortizing"
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "text-gray-600 dark:text-gray-300"
          }`}
        >
          Loan (pays down over time)
        </button>
        <button
          type="button"
          onClick={() => chooseKind("simple")}
          className={`min-h-11 flex-1 px-3 py-2 ${
            kind === "simple"
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "text-gray-600 dark:text-gray-300"
          }`}
        >
          Simple balance
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            type="text"
            required
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            placeholder="e.g. Cathay mortgage"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="liability_type"
            value={liabilityType}
            onChange={(e) => onLiabilityTypeChange(e.target.value)}
            className={inputClass}
          >
            {LIABILITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Currency
          <select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={inputClass}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {kind === "simple" ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Current balance
              <input
                name="balance"
                type="number"
                step="0.01"
                min="0"
                required
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="amount owed"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Interest rate % (optional)
              <input
                name="interest_rate"
                type="number"
                step="0.001"
                min="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="e.g. 2.1"
                className={inputClass}
              />
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Original amount
              <input
                name="original_principal"
                type="number"
                step="0.01"
                min="0"
                required
                value={originalPrincipal}
                onChange={(e) => setOriginalPrincipal(e.target.value)}
                placeholder="what you borrowed"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Interest rate %
              <input
                name="interest_rate"
                type="number"
                step="0.001"
                min="0"
                required
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="0 is fine"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Term (years)
              <input
                name="term_years"
                type="number"
                step="0.1"
                min="0"
                required
                value={termYears}
                onChange={(e) => setTermYears(e.target.value)}
                placeholder="e.g. 20"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Start date
              <input
                name="start_date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </label>
          </>
        )}
      </div>

      {kind === "amortizing" && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Estimated balance today:{" "}
          <span className="font-medium">
            {previewBalance !== null
              ? money(previewBalance, currency)
              : "fill in the loan details above"}
          </span>
        </p>
      )}

      {/* Anchor — edit-only, amortizing-only, per spec */}
      {isEdit && kind === "amortizing" && (
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-sm font-medium">Correct the balance</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Corrected balance
              <input
                name="anchor_balance"
                type="number"
                step="0.01"
                min="0"
                value={anchorBalance}
                onChange={(e) => setAnchorBalance(e.target.value)}
                placeholder="actual balance now"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              As of date
              <input
                name="anchor_date"
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Use this if you&apos;ve made extra payments and the estimate has
            drifted.
          </p>
        </div>
      )}

      {(clientError ?? state.error) && (
        <p className="text-sm text-red-600">{clientError ?? state.error}</p>
      )}

      <button
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : (submitLabel ?? "Add debt")}
      </button>
    </form>
  );
}
