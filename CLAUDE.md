@AGENTS.md

# Finance App — Project Context

Personal net worth tracker. Not a budgeting app. The differentiator is an asset
vault with AI/market-data valuation, split into liquid vs illiquid wealth.
Mobile-first. Single user for now (Marcus).

## Stack and deploy

- Next.js 16.2.10 (App Router, TypeScript, Turbopack), React 19, Tailwind v4
- Auth/routing gate lives in `proxy.ts` — Next 16 renamed Middleware to
  "Proxy" (see AGENTS.md's warning about API differences; this is the
  concrete instance of it). It refreshes the Supabase session and redirects
  unauthenticated requests to `/login`.
- Supabase: auth + Postgres
- Anthropic API for valuations and reminders, model `claude-haiku-4-5`
- Yahoo Finance for stock prices, gold spot, and FX rates (`lib/prices/yahoo.ts`)
- Local dev: `npm run dev` at localhost:3000
- Deployed to Vercel: finance-app-eosin-alpha.vercel.app. Every push to `main`
  on GitHub auto-deploys.
- Env vars must exist in BOTH `.env.local` and the Vercel dashboard
  (Settings → Environment Variables). Adding/renaming one the app depends on
  needs both, or the live site breaks at runtime while the build still passes.
- Email confirmation is ON in Supabase.

## Migrations

Flat in `supabase/`, not `supabase/migrations/`. Numbered sequentially,
002 through 015 (highest file present: `015_cash_confirmed_at.sql`).
**Last CONFIRMED applied: 014.** 015 is written and printed but not yet
confirmed run — until it is, `app/dashboard/page.tsx`'s `cash_confirmed_at`
select fails with a schema-cache error, caught and treated as "unavailable"
rather than crashing the page (see Schema gotchas' note on this exact
failure mode). Ask Marcus before assuming `user_profiles.cash_confirmed_at`
exists live.

Never run, apply, or push a migration. PRINT the SQL in one copy-paste block;
Marcus runs it in the Supabase SQL Editor by hand.

The SQL Editor runs as a role that BYPASSES RLS — `delete from x;` there acts
on every user's rows, not just "the current user." Harmless today (single
user), but say so explicitly when handing over SQL that deletes or updates.

Code reading a column that doesn't exist yet in the DB fails with a schema-
cache error, not a normal SQL error. If it persists after Marcus runs the
migration, have him run `notify pgrst, 'reload schema';` to clear it.

Postgres enums: never create one, or add a value to an existing one, in a
migration that also uses it — migration 008 had to split into 008a/008b for
exactly this. Use `text` + `CHECK` instead (every currency column already
does: plain `text not null default '...'`, no enum/CHECK, ever).

## Schema gotchas

- `liabilities.balance` is a stale snapshot for amortizing rows — written at
  save time, never updated. NEVER read it directly for an amortizing
  liability; always go through `currentBalance()` in `lib/amortization.ts`.
  `liability_type` (what the debt IS) and `kind` (`'simple'|'amortizing'`,
  how the balance BEHAVES) are independent — don't derive one from the other.
- Every money amount is stored in the currency it was entered in and is
  NEVER converted in storage. `transactions`, `cash_accounts`, `assets`,
  `holdings`, `liabilities` each carry their own `currency` column;
  `user_rules.currency` and `user_profiles.preferred_currency` do too as of
  013/014 (confirmed live). Conversion only ever happens at display time
  (see FX rate access below).
- `lib/amortization.ts` is pure math — no Supabase imports, no React, no
  side effects. Keep it that way.
- Liability totals flow through `lib/calculations/networth.ts`, the single
  call site for `currentBalance()`. Change liability math there only.

## Conventions

- Controlled inputs default to `''`, never `undefined`/`null`. Hydrate
  nullable DB columns with `String(x ?? '')`; parse to number only at submit
  time. Conditional RENDERING of a field is fine; conditional VALUE is not —
  two different inputs at the same JSX position reconciled by a ternary get
  treated as the same DOM node by React (a real bug in `liability-form.tsx`
  once).
- ASCII only in `app/globals.css`. An em dash inside a CSS comment there once
  silently truncated the entire compiled stylesheet from that point on —
  every token after it vanished from the build, no error thrown. Plain
  hyphens only in CSS comments.
- `react-hooks/set-state-in-effect` is a known, deliberately-unfixed lint
  warning, confirmed as the ONLY lint issue anywhere in the project (6
  errors, one each) in: `app/transactions/transaction-form.tsx`,
  `app/holdings/holding-form.tsx`, `app/liabilities/liability-form.tsx`,
  `app/assets/asset-form.tsx`, `app/net-worth-view.tsx`,
  `app/portfolio/portfolio-view.tsx`. Does not block `next build`. Don't fix
  it as a side quest.
- `Money` (`components/ui/Money.tsx`) already does `Intl.NumberFormat`
  currency formatting, tabular-nums, and pos/neg coloring via its `signed`
  prop. Don't hand-roll currency formatting elsewhere. If `signed` can't
  express the color you need (e.g. income vs. expense, where positive isn't
  always "good"), override via `className="[--text:var(--pos)]"` /
  `"[--text:var(--neg)]"` — this shadows the CSS variable Money's own class
  reads, which is reliable; competing Tailwind color classes on the same
  element are not (class order in the string doesn't decide the winner).
- Mixed-currency amounts are never silently summed. Convention used
  everywhere this comes up (see `app/dashboard/page.tsx` for four examples):
  if every row shares one currency, show the real total via `Money`; if not,
  show the raw number with the `.tnum` class and no currency symbol, plus a
  small "(mixed currencies)" note. Reuse this, don't invent a new one.
- No npm packages without asking first.
- Only touch files explicitly listed in the task. If the real schema or file
  layout differs from what the task describes, STOP and print what's
  actually there instead of guessing at column names.

## Design system

Tokens in `app/globals.css` as CSS custom properties — `--bg`, `--surface`,
`--surface-2`, `--border`, `--border-strong`, `--text`, `--text-muted`,
`--text-subtle`, `--accent`, `--accent-fg`, `--pos`, `--neg`; spacing
`--sp-1..8`; radius `--r-sm/md/lg`; type scale `--t-xs..2xl`. Light values on
`:root`, dark under `prefers-color-scheme: dark` — no manual theme toggle.
Used via Tailwind arbitrary values, e.g. `bg-[var(--surface)]`.

Two fonts, both self-hosted via `next/font/google` in `app/layout.tsx`, wired
into Tailwind's `@theme inline` in `app/globals.css` as `--font-sans` (Geist,
weights 400/500/600) and `--font-mono` (JetBrains Mono, weights
400/500/600/700 — the 700 exists only for the net worth headline). `body`'s
`font-family: var(--font-sans)` makes sans the app-wide default; `font-mono`
is applied ad-hoc via className wherever a NUMERIC FIGURE renders — always
inside `Money` (`components/ui/Money.tsx`, which also scopes `tracking-tight`
to its own `size="2xl"` — checked visually, JetBrains Mono reads loose at
display size but is fine smaller), plus the two mixed-currency raw-number
fallback spans in `app/dashboard/page.tsx` and every figure in
`app/net-worth-view.tsx` (which predates the token system and isn't on it
otherwise — still raw Tailwind classes and its own local `money()` formatter,
just with `font-mono` added to each figure). Never applied to labels,
headings, body copy, buttons, or form inputs. `.tnum` (`font-variant-numeric:
tabular-nums`) still sits alongside `font-mono` on every figure — redundant
now that the font itself is monospace (verified: every character, digit or
not, renders at an identical pixel width), but left in rather than removed,
partly for resilience if the mono font ever fails to load.

Shared components in `components/ui/` (`@/components/ui`): `Card`,
`PageHeader` (title + optional `nav` slot — **no subtitle prop**; pages
wanting one render a sibling `<p>` right after it — see `app/dashboard`,
`app/plan`, `app/settings`), `Button` (primary/secondary/danger, one size),
`Input`, `Select`, `Label`, `Field`, `Money`.

Only some pages are on this system: dashboard, transactions, onboarding,
more, plan, settings-shell. Cash, holdings, liabilities, assets, portfolio,
reminders, and every edit/detail sub-page are still original unstyled
markup. That's expected — pages get restyled one at a time, not a bug to fix
in passing.

## Navigation

No top-of-page link rows. A fixed bottom tab bar (`app/bottom-tab-bar.tsx`,
mounted via `app/app-shell.tsx` in the root layout) has 4 tabs: Home
(`/dashboard`), Transactions (`/transactions`), Net worth (`/`), More
(`/more`). `app-shell.tsx` hides the bar on `/login` and `/onboarding*` —
that check exists in exactly one place (`isChromeHidden`); don't duplicate
it elsewhere. `/more` lists Plan, Portfolio, Reminders, Settings — Cash,
Assets, Liabilities, Holdings are reached from the Net Worth page's tappable
summary boxes instead, not from More.

## Cost control

Per-user cap of 20 AI credits/day, enforced server-side via a SECURITY
DEFINER function (`consume_ai_credit`, migration 008b), resets at UTC
midnight (8am Taipei). Gold and vehicle valuations are free (live spot /
depreciation formula) and don't consume credits. Never add an Anthropic API
call to something computable with arithmetic — amortization, FX conversion,
and totals are math, not AI.

## Shared things to reuse

- **`saveSpendingRules`** — `app/settings/actions.ts`. The one save action
  for the user's plan (spending limit, savings target, up to 2 category
  limits, spender lean, saving-toward text, base currency). Called by
  `app/settings/rules-form.tsx` (rendered at `/plan`, not `/settings` — the
  file didn't move, only which page imports it did) and
  `app/onboarding/onboarding-wizard.tsx`. One save, writes `user_rules` rows
  and `user_profiles.preferred_currency` together. Don't add a second save
  action for plan data.
- **`loadRulesDefaults`** — `app/settings/defaults.ts`. Loads plan
  prefill/state: rule amounts, `preferred_currency`, `onboarding_completed_at`,
  and `savingsTargetCurrency` (the specific currency the savings-target rule
  was actually saved in — distinct from `preferred_currency`, which can
  change later). Called by `/plan`, `/onboarding`, and
  `app/dashboard/page.tsx`'s safe-to-spend card.
- **`CURRENCIES` / `CURRENCY_CODES` / `currencyPlaceholder()`** —
  `lib/currencies.ts`. The single source of truth for supported currencies
  (TWD, USD only). `lib/tickers.ts`'s `SUPPORTED_CURRENCIES` (used by cash,
  holdings, liabilities, and asset forms) derives from it — there is really
  only one list in the codebase. Adding a currency is one new entry here.
- **`MANAGE_LINK_CLASS`** — `app/dashboard/page.tsx`. Shared class string
  for a `<Link>` styled identically to `<Button variant="secondary">`.
  Exists because nesting a native `<button>` inside an `<a>` is invalid
  HTML — use this instead of wrapping `Button` in `Link` for any
  styled-as-a-button navigation.
- **`currentBalance()`** — `lib/amortization.ts`. See Schema gotchas.
- **FX rate access** — `getPriceProvider().getFxRate(from, to)` from
  `lib/prices` (currently `lib/prices/yahoo.ts`, TTL-cached). Two call sites:
  `lib/calculations/networth.ts` wraps it in its own `fxMemo()` inside the
  full net-worth computation (also pulls in live portfolio prices — don't
  call `computeNetWorth` just to get one rate); `app/dashboard/page.tsx`'s
  `convertToTWD()` calls `getFxRate` directly for one cheap lookup when the
  safe-to-spend card needs to reconcile cash/spending/savings-target that
  are each a single but different currency. Prefer the direct call unless
  you actually need the whole net-worth computation.

## Current state

**Built and working:** net worth page (liquid/illiquid/liabilities, FX
toggle, trend chart), its three summary boxes relabeled in plain language
(Cash & Investments / Assets / Debts) and made tappable — Assets and Debts
link out whole, Cash & Investments' two sub-lines link to `/cash` and
`/holdings` individually; bottom tab bar navigation (see Navigation);
dashboard Home tab with a Cash & Money-left card above a spending card, each
with a "Manage" link, and no account chrome (email/sign-out moved out — see
below); Money left is a running balance (cash + income − expenses since
`user_profiles.cash_confirmed_at`, inclusive, no upper bound so future-dated
transactions count), replacing an earlier calendar-month-scoped figure that
reset to the full cash balance every 1st and ignored income entirely —
`cash_confirmed_at` is stamped to `now()` on every `/cash` save (add, edit,
delete — `app/cash/actions.ts`'s `stampCashConfirmed`), and the card shows
"Balances confirmed <date>" so the figure isn't magic; a one-question-per-
screen onboarding wizard, starting with "which
currency do you think in"; `/plan` (the user's spending plan, moved out of
`/settings`) and `/settings` (category merging plus an Account section —
signed-in email as read-only text, and Sign out using the same handler from
`app/login/actions.ts`, not a reimplementation); phase-1 multi-currency
base-currency work — every transaction/cash/liability/asset form has a
currency picker, and every stored amount is
labeled with its real currency instead of assumed.

**In flight / unfinished:**
- Cash, holdings, liabilities, assets, portfolio, reminders, and their
  edit/detail sub-pages are still unstyled (see Design system).
- Dashboard's per-category spending rows and vs-last-month delta line still
  assume a single currency (`SPENDING_CURRENCY = "TWD"`), even though the
  headline spending total and the Left-this-month figure now handle mixed
  currencies honestly. Known gap, not yet closed.

## Deliberately out of scope

- Any currency beyond TWD and USD.
- A global display-currency toggle — a read-time lens over stored amounts,
  freely changeable, never rewriting storage. What's built is BASE currency
  only (what a stored number means, set at onboarding, near-immutable). The
  toggle is a distinct later phase; don't build it unless explicitly asked.
- A display-name field, reminders toggle, delete-data section, or currency
  switcher on `/settings`. (Account/sign-out was in this list too, until the
  task that added the Account section to `/settings` explicitly asked for it.)

## Working style

Marcus is a beginner with the command line and databases but learns fast.
Explain the why behind a design decision, not just the instruction. Give
exact, copy-pasteable commands. Say when something is unverifiable rather
than implying it was tested. You cannot log into the app, so UI verification
is always his job.
