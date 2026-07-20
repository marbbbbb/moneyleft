@AGENTS.md

# Finance App — Project Context

Personal net worth tracker. Not a budgeting app. The differentiator is an asset
vault with AI/market-data valuation, split into liquid vs illiquid wealth.
Mobile-first. Single user for now (Marcus).

## Stack

- Next.js (App Router, TypeScript, Turbopack), Tailwind
- Supabase: auth + Postgres
- Anthropic API for valuations and reminders, model `claude-haiku-4-5`
- Yahoo Finance for stock prices and gold spot
- Local dev: `npm run dev` at localhost:3000

## Hard rules

**Migrations.** They live FLAT in `supabase/`, not in `supabase/migrations/`.
Numbered sequentially: 002 through 012. **Latest applied is 012.**
Never run, apply, or push a migration. PRINT the SQL only. Marcus pastes it
into the Supabase SQL Editor by hand.

**Postgres enums.** Do not create new enums or add values to existing ones in a
migration that also uses them. Migration 008 had to be split into 008a/008b for
exactly this reason. Use `text` + a `CHECK` constraint instead.

**API keys.** The Anthropic key lives in `.env.local`, server-side only. Never
add a `NEXT_PUBLIC_` prefix. Never reference it in a client component.

**No new npm packages** without asking first.

**Scope.** Only touch files explicitly listed in the task. If the real schema or
file layout differs from what the task describes, STOP and print what's actually
there instead of guessing at column names.

## Schema gotchas

**liabilities** has two independent concepts, do not derive one from the other:
- `liability_type` — a Postgres enum (mortgage, car_loan, student_loan,
  credit_card, personal_loan, other). What the debt IS.
- `kind` — text + CHECK ('simple' | 'amortizing'). How the balance BEHAVES.

The column is `balance`, not `current_balance`.

**`balance` is a stale snapshot for amortizing rows.** It is written at save time
and never updated. NEVER read it directly for an amortizing liability. Always go
through `currentBalance()` in `lib/amortization.ts`.

`lib/amortization.ts` is pure math. No Supabase imports, no React, no side
effects. Keep it that way.

## Where things are summed

Liability totals flow through `lib/calculations/networth.ts` — this is the single
call site for `currentBalance()`. Consumed by `app/page.tsx`,
`app/net-worth-view.tsx`, and `lib/calculations/snapshots.ts`.
`app/cash/page.tsx` references it for display. If you change liability math,
change it in networth.ts only.

## Forms convention

All text/number/date inputs are fully controlled. State is typed `string` and
initialized to `''`. Never `undefined`, never `null`, never a number. Hydrate
nullable DB columns with `String(x ?? '')`. Parse to number only at submit time.

Conditional RENDERING of a field is fine. Conditional VALUE is not. Two different
inputs rendered at the same JSX tree position by a ternary get reconciled by
React as the same DOM node, which caused a real controlled/uncontrolled bug in
`liability-form.tsx`.

## Cost control

Per-user cap of 20 AI credits/day, enforced server-side via a SECURITY DEFINER
function, resets at UTC midnight (8am Taipei). Gold and vehicle valuations are
free (live spot / depreciation formula) and don't consume credits.

Never add an Anthropic API call to something that can be computed with
arithmetic. Amortization, FX conversion, and totals are math, not AI.

## Known conditions — leave alone

`react-hooks/set-state-in-effect` lint warning exists in `TransactionForm`,
`HoldingForm`, and `liability-form.tsx`. Pre-existing repo-wide pattern, does not
block `next build`. Do not fix it as a side quest.

## Before deploying

Email confirmation is currently OFF in Supabase (disabled for solo testing).
It MUST be turned back on before the app has a public URL:
Dashboard → Authentication → Sign In / Providers → Email → "Confirm email".

## Working style

Marcus is a beginner with the command line and databases but learns fast. Explain
the why behind a design decision, not just the instruction. Give exact,
copy-pasteable commands. Say when something is unverifiable rather than implying
it was tested. You cannot log into the app, so UI verification is always his job.
