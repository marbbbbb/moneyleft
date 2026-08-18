"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveSpendingRules } from "../settings/actions";
import { SPENDER_TYPES } from "@/lib/rules";
import { CURRENCIES, currencyPlaceholder } from "@/lib/currencies";
import type { RulesDefaults } from "../settings/rules-form";
import { Button, Card, Field, Input, Select } from "@/components/ui";

const TOTAL_STEPS = 8;
const LAST_STEP = TOTAL_STEPS - 1;
const TRANSITION_MS = 300;
const WELCOME_STEP = 1;

type Answers = RulesDefaults;
type Phase = "idle" | "exiting" | "entering";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// SSR has no window; assume motion is fine until hydration reads the real value.
function getReducedMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-[var(--sp-3)] py-[var(--sp-2)]">
      <dt className="text-[length:var(--t-sm)] text-[var(--text-muted)]">{label}</dt>
      <dd className="text-[length:var(--t-sm)] text-[var(--text)]">{value}</dd>
    </div>
  );
}

export function OnboardingWizard({ defaults }: { defaults: RulesDefaults }) {
  const [state, formAction, pending] = useActionState(saveSpendingRules, {});

  const [answers, setAnswers] = useState<Answers>({
    ...defaults,
    currency: defaults.currency || "TWD",
    spenderType: defaults.spenderType || "balanced",
  });

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const timeoutRef = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((a) => ({ ...a, [key]: value }));

  // Nothing in this quiz is actually required today (rules-form.tsx has no
  // `required` inputs), so every step currently passes. The currency step
  // (0) can never actually be empty either — it's a <select> that always
  // carries a real value — so this stays a real check, not a formality.
  const isStepValid = () => true;

  const goTo = (target: number, dir: 1 | -1) => {
    if (target < 0 || target > LAST_STEP || phase !== "idle") return;
    setDirection(dir);
    if (reducedMotion) {
      setStep(target);
      return;
    }
    setPhase("exiting");
    timeoutRef.current = window.setTimeout(() => {
      setStep(target);
      setPhase("entering");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("idle"));
      });
    }, TRANSITION_MS);
  };

  const handleNext = () => isStepValid() && goTo(step + 1, 1);
  const handleBack = () => goTo(step - 1, -1);

  const exitClass = direction === 1 ? "-translate-x-6 opacity-0" : "translate-x-6 opacity-0";
  const enterStartClass = direction === 1 ? "translate-x-6 opacity-0" : "-translate-x-6 opacity-0";
  const stepClass =
    phase === "exiting" ? exitClass : phase === "entering" ? enterStartClass : "translate-x-0 opacity-100";

  const navBusy = phase !== "idle";
  const amountPlaceholder = currencyPlaceholder(answers.currency);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Only the review step's Finish button is type="submit"; this is a
        // second line of defense against implicit Enter-key submission from
        // an earlier step (e.g. a lone text field triggering native submit).
        if (step !== LAST_STEP) e.preventDefault();
      }}
      className="flex w-full flex-col"
    >
      <Card className="mx-auto flex w-full max-w-md flex-col">
        {/* Progress */}
        <div className="mb-[var(--sp-6)]">
          <div className="mb-[var(--sp-2)] flex items-center justify-between">
            <span className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
              Step {step + 1} of {TOTAL_STEPS}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-[var(--r-sm)] bg-[var(--border)]">
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-300 ease-out"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content — stable min-height so nav/progress never jump */}
        <div className="flex min-h-[420px] flex-col justify-center overflow-hidden">
          <div
            className={`flex flex-col gap-[var(--sp-4)] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${stepClass}`}
          >
            {step === 0 && (
              <div className="flex flex-col gap-[var(--sp-3)]">
                <h2 className="text-[length:var(--t-xl)] font-semibold text-[var(--text)]">
                  Which currency do you think in?
                </h2>
                <Field label="Currency">
                  <Select
                    value={answers.currency}
                    onChange={(e) => set("currency", e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  You can log transactions in other currencies later. This just
                  sets what these next questions mean.
                </p>
              </div>
            )}

            {step === WELCOME_STEP && (
              <div className="flex flex-col items-center gap-[var(--sp-3)] py-[var(--sp-8)] text-center">
                <h1 className="text-[length:var(--t-xl)] font-semibold text-[var(--text)]">
                  Let&apos;s set a few rules
                </h1>
                <p className="text-[length:var(--t-sm)] text-[var(--text-muted)]">
                  A handful of quick questions so the app can gently keep an eye on
                  things for you. There are no wrong answers, nothing here is a
                  commitment, and you can change or skip any of it later.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-[var(--sp-3)]">
                <h2 className="text-[length:var(--t-xl)] font-semibold text-[var(--text)]">
                  What would you like to keep your total monthly spending under?
                </h2>
                <Field label={`Monthly spending limit (${answers.currency})`}>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    inputMode="decimal"
                    value={answers.monthlyCap}
                    onChange={(e) => set("monthlyCap", e.target.value)}
                    placeholder={`e.g. ${amountPlaceholder}`}
                  />
                </Field>
                <p className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  Rough numbers are fine — you can change this any time. Leave blank
                  to skip.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-[var(--sp-3)]">
                <h2 className="text-[length:var(--t-xl)] font-semibold text-[var(--text)]">
                  How much would you like to put aside each month?
                </h2>
                <Field label={`Monthly savings target (${answers.currency})`}>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    inputMode="decimal"
                    value={answers.savingsTarget}
                    onChange={(e) => set("savingsTarget", e.target.value)}
                    placeholder={`e.g. ${amountPlaceholder}`}
                  />
                </Field>
                <p className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  Checked against income minus expenses. Skipped in months where you
                  haven&apos;t recorded any income. Leave blank to skip.
                </p>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col gap-[var(--sp-3)]">
                <h2 className="text-[length:var(--t-xl)] font-semibold text-[var(--text)]">
                  Anything you want to keep an eye on?
                </h2>
                <p className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  Optional — add up to two, or skip. Use the same names you use on
                  transactions (e.g. Groceries, Dining).
                </p>
                <div className="grid grid-cols-1 gap-[var(--sp-3)] sm:grid-cols-2">
                  <Field label="Category">
                    <Input
                      type="text"
                      value={answers.category1}
                      onChange={(e) => set("category1", e.target.value)}
                      placeholder="e.g. Dining"
                    />
                  </Field>
                  <Field label={`Monthly limit (${answers.currency})`}>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      inputMode="decimal"
                      value={answers.categoryLimit1}
                      onChange={(e) => set("categoryLimit1", e.target.value)}
                      placeholder={`e.g. ${amountPlaceholder}`}
                    />
                  </Field>
                  <Field label="Category (optional)">
                    <Input
                      type="text"
                      value={answers.category2}
                      onChange={(e) => set("category2", e.target.value)}
                      placeholder="e.g. Shopping"
                    />
                  </Field>
                  <Field label={`Monthly limit (${answers.currency})`}>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      inputMode="decimal"
                      value={answers.categoryLimit2}
                      onChange={(e) => set("categoryLimit2", e.target.value)}
                      placeholder={`e.g. ${amountPlaceholder}`}
                    />
                  </Field>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="flex flex-col gap-[var(--sp-3)]">
                <h2 className="text-[length:var(--t-xl)] font-semibold text-[var(--text)]">
                  Which sounds more like you?
                </h2>
                <Field label="Your style">
                  <Select
                    value={answers.spenderType}
                    onChange={(e) => set("spenderType", e.target.value)}
                  >
                    {SPENDER_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  Only used to word your reminders in a way that suits you.
                </p>
              </div>
            )}

            {step === 6 && (
              <div className="flex flex-col gap-[var(--sp-3)]">
                <h2 className="text-[length:var(--t-xl)] font-semibold text-[var(--text)]">
                  Anything you&apos;re saving toward?
                </h2>
                <Field label="Savings goal (optional)">
                  <Input
                    type="text"
                    value={answers.savingToward}
                    onChange={(e) => set("savingToward", e.target.value)}
                    placeholder="e.g. a trip, a home deposit, a rainy-day fund"
                  />
                </Field>
                <p className="text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  Leave blank to skip.
                </p>
              </div>
            )}

            {step === 7 && (
              <div className="flex flex-col gap-[var(--sp-2)]">
                <h2 className="text-[length:var(--t-xl)] font-semibold text-[var(--text)]">
                  Here&apos;s what you told us
                </h2>
                <dl className="flex flex-col divide-y divide-[var(--border)]">
                  <SummaryRow
                    label="Currency"
                    value={
                      CURRENCIES.find((c) => c.code === answers.currency)?.code ??
                      answers.currency
                    }
                  />
                  <SummaryRow
                    label="Monthly spending limit"
                    value={answers.monthlyCap || "Skipped"}
                  />
                  <SummaryRow
                    label="Monthly savings target"
                    value={answers.savingsTarget || "Skipped"}
                  />
                  <SummaryRow
                    label="Watched categories"
                    value={
                      [
                        answers.category1 &&
                          `${answers.category1} (${answers.categoryLimit1 || "—"})`,
                        answers.category2 &&
                          `${answers.category2} (${answers.categoryLimit2 || "—"})`,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Skipped"
                    }
                  />
                  <SummaryRow
                    label="Spender lean"
                    value={
                      SPENDER_TYPES.find((s) => s.value === answers.spenderType)
                        ?.label ?? answers.spenderType
                    }
                  />
                  <SummaryRow
                    label="Saving toward"
                    value={answers.savingToward || "Skipped"}
                  />
                </dl>
                <p className="mt-[var(--sp-2)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
                  You can change any of this any time in your Plan.
                </p>
              </div>
            )}
          </div>
        </div>

        {state.error && (
          <p className="mt-[var(--sp-3)] text-[length:var(--t-sm)] text-[var(--neg)]">
            {state.error}
          </p>
        )}

        {/* Nav */}
        <div className="mt-[var(--sp-6)] flex items-center justify-between gap-[var(--sp-3)]">
          {step > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleBack}
              disabled={navBusy}
            >
              Back
            </Button>
          ) : (
            <span />
          )}

          {step < LAST_STEP ? (
            <Button
              type="button"
              variant="primary"
              onClick={handleNext}
              disabled={navBusy || !isStepValid()}
            >
              {step === WELCOME_STEP ? "Get started" : "Next"}
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={pending || navBusy}>
              {pending ? "Saving…" : "Finish"}
            </Button>
          )}
        </div>
      </Card>

      {/* Mirrors `answers` under the exact field names saveSpendingRules reads.
          Always mounted (unlike the per-step visible inputs above, which carry
          no `name`), so the one and only submit — on the review step — carries
          every answer regardless of which step is currently shown. */}
      <input type="hidden" name="currency" value={answers.currency} />
      <input type="hidden" name="monthly_cap" value={answers.monthlyCap} />
      <input type="hidden" name="savings_target" value={answers.savingsTarget} />
      <input type="hidden" name="category_1" value={answers.category1} />
      <input type="hidden" name="category_limit_1" value={answers.categoryLimit1} />
      <input type="hidden" name="category_2" value={answers.category2} />
      <input type="hidden" name="category_limit_2" value={answers.categoryLimit2} />
      <input type="hidden" name="spender_type" value={answers.spenderType} />
      <input type="hidden" name="saving_toward" value={answers.savingToward} />
      <input type="hidden" name="redirect_to" value="/dashboard" />
    </form>
  );
}
