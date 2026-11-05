@AGENTS.md

# MoneyLeft — Project Context

Personal net worth tracker (renamed from "Finance App" - the repo directory,
`package.json`'s name, and the Vercel project all still say `finance-app`;
only user-facing copy and metadata changed, deliberately, see Current state).
Not a budgeting app. The differentiator is an asset vault with AI/market-data
valuation, split into liquid vs illiquid wealth. Mobile-first. Single user
for now (Marcus).

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
- Deployed to Vercel: moneyleft.vercel.app. Every push to `main` on GitHub
  auto-deploys.
- Env vars must exist in BOTH `.env.local` and the Vercel dashboard
  (Settings → Environment Variables). Adding/renaming one the app depends on
  needs both, or the live site breaks at runtime while the build still passes.
- Email confirmation is ON in Supabase.
- `DEMO_EMAIL` / `DEMO_PASSWORD` (server-only, never `NEXT_PUBLIC_`) power the
  `/login` page's "View demo" affordance — a third, visually quiet action
  (`app/login/login-form.tsx`) that signs into a preset account via
  `demoLogin` (`app/login/actions.ts`), reading the credentials straight from
  `process.env` server-side, never from form data. Unset either var and the
  button doesn't render at all (checked in `app/login/page.tsx`), rather than
  rendering and failing. Marcus creates the demo account and its sample data
  in Supabase himself — nothing here does that.

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
`--text-subtle`, `--accent`, `--accent-fg`, `--pos`, `--neg`, `--warn`;
tinted status-pill/card tokens `--warn-tint`, `--warn-border`, `--warn-soft`
/`-fg`, `--pos-soft`/`-fg`, `--info-soft`/`-fg` (blue, market data),
`--ai-soft`/`-fg` (purple, AI estimates), `--neutral-soft`/`-fg`/`-fg-muted`
(their values are Tailwind palette oklch copies, so batch D changed nothing
visually; retune them in Phase 2); spacing
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
fallback spans in `app/dashboard/page.tsx`, the category row figure in
`app/dashboard/category-disclosure.tsx`, and the one remaining hand-formatted
figure in `app/net-worth-view.tsx` (the unrealized-gain line, which keeps its
own local `money()` because it is a sign + amount + percent composite; every
other net worth figure now goes through `Money`). Never applied to labels,
headings, body copy, buttons, or form inputs. `.tnum` (`font-variant-numeric:
tabular-nums`) still sits alongside `font-mono` on every figure — redundant
now that the font itself is monospace (verified: every character, digit or
not, renders at an identical pixel width), but left in rather than removed,
partly for resilience if the mono font ever fails to load.

Shared components in `components/ui/` (`@/components/ui`): `Card`,
`PageHeader` (title + optional `nav` slot — **no subtitle prop**; pages
wanting one render a sibling `<p>` right after it — see `app/dashboard`,
`app/plan`, `app/settings`), `Button` (variants primary/secondary/danger/
outline; sizes `default` - `min-h-11`, the 44px tap target, built in so no
call site needs it - and `compact`, for small inline chips only, today just
the portfolio per-holding currency chip), `TextButton` (quiet inline
Edit/Delete/Remove action, 44px tap target; `tone` muted/danger, `size`
sm/xs, renders a `Link` when given `href`), `Input`, `Textarea` (same styling
as `Input`), `Select`, `Label`, `Field`, `Money`.

**Phase 1 (token migration) is complete** (batches A-D below): every page,
`components/ui`, and `lib/assets.ts` color helpers go through tokens; no
named Tailwind palette class, raw hex, or rgb value remains in `app/`,
`components/`, or `lib/`. Phase 2 (the visual re-skin) can reach everything by
editing token values and `components/ui`.

### Token migration checklist

Design-token migration (started as "batch A") tracked here so this list
doesn't silently drift from what's on disk. Update it whenever a batch lands.

**Done (batch A):**
- Dead scaffold tokens `--background`/`--foreground` removed from
  `app/globals.css` (confirmed unused first).
- `app/login/login-form.tsx` and `app/login/page.tsx` — full migration onto
  `components/ui` (`Field`, `Input`, `Button`) and tokens.
- Edit-page **shells** only — `app/cash/[id]/edit/page.tsx`,
  `app/holdings/[id]/edit/page.tsx`, `app/liabilities/[id]/edit/page.tsx`,
  `app/assets/[id]/edit/page.tsx`, `app/transactions/[id]/edit/page.tsx` — now
  use `PageHeader` and token spacing instead of raw `text-2xl font-semibold`
  and raw `gap-8 p-4 sm:p-6`. The form components they render are unchanged.
- `app/reminders-nav-link.tsx`'s unread badge — `var(--neg)`,
  `var(--accent-fg)`, `var(--t-xs)` in place of `bg-red-600`/`text-white`/
  `text-[10px]`.

**Done (batch B) — cash, holdings, assets, liabilities** (page, form, and
every detail/edit/valuation sub-file; `Field`/`Input`/`Select`/`Button`/
`PageHeader`/`Card`/`Money` plus tokens; no logic touched):
- `app/cash/page.tsx`, `app/cash/cash-form.tsx`
- `app/holdings/page.tsx`, `app/holdings/holding-form.tsx`
- `app/assets/page.tsx`, `app/assets/asset-form.tsx`,
  `app/assets/[id]/page.tsx`, `app/assets/[id]/edit/asset-edit-form.tsx`,
  `app/assets/[id]/estimate-button.tsx`, `app/assets/[id]/valuation-form.tsx`
- `app/liabilities/page.tsx`, `app/liabilities/liability-form.tsx`

**Done (batch C) — settings forms, reminders, portfolio, net worth home, photo uploader:**
- `app/settings/rules-form.tsx` (`/plan`), `app/settings/category-merge.tsx` (`/settings`)
- `app/reminders/page.tsx`, `app/reminders/auto-check.tsx`
- `app/portfolio/page.tsx`, `app/portfolio/portfolio-view.tsx`
- `app/page.tsx`, `app/net-worth-view.tsx`, `app/net-worth-trend.tsx`,
  `app/liquid-illiquid-pie.tsx` (chart colors are now `fill-[var(--pos)]` /
  `stroke-[color:var(--pos)]` classes; the pie's two dark-mode gaps are fixed;
  the four `transition-colors` hovers in `net-worth-view.tsx` have
  `motion-reduce:transition-none`)
- `app/assets/[id]/photo-uploader.tsx`

**Done (batch D) - button sizes, warn token, textarea, text buttons, asset colors, value chart:**
- `components/ui/Button.tsx`: `min-h-11` built into the default size (the
  only intended visual change of batch D - every `Button` is now 44px tall);
  `compact` size + `outline` variant for the portfolio currency chip; the
  redundant per-call `min-h-11` in `app/login/login-form.tsx` removed.
- New `--warn` and tinted pill/card tokens in `app/globals.css`, applied in
  `app/reminders/page.tsx`, `app/reminders/auto-check.tsx`,
  `app/assets/[id]/estimate-button.tsx`, and `lib/assets.ts`
  (`confidenceClass`, `sourceBadgeClass`); `changeColorClass` now returns
  `--pos`/`--neg`.
- New `components/ui/Textarea.tsx`, used in `app/assets/asset-form.tsx` and
  `app/assets/[id]/edit/asset-edit-form.tsx` (local `inputClass` deleted).
- New `components/ui/TextButton.tsx`, replacing the hand-styled Edit/Delete
  actions in `app/cash/page.tsx`, `app/holdings/page.tsx`,
  `app/liabilities/page.tsx`, `app/assets/page.tsx`, and the photo Remove in
  `app/assets/[id]/page.tsx` (the asset ones gained the 44px tap target).
- `app/assets/[id]/value-chart.tsx`: hex strokes replaced with
  `stroke-[color:var(--pos|neg)]` / `fill-[var(--pos|neg)]`, same as
  `net-worth-trend.tsx`.

### Phase 2 (visual re-skin) - design items deliberately left
- Native checkbox and file inputs (no color classes) in
  `app/settings/category-merge.tsx` and `app/assets/[id]/photo-uploader.tsx`;
  a `Checkbox`/`FileInput` would finish them.
- Raw page spacing and section headings on batch B/C pages: `<main>` still
  `gap-8 p-4 sm:p-6` (not the `--sp-*` shell the edit pages use), headings
  still `text-lg font-medium`.
- Dark-mode pie empty state (`app/liquid-illiquid-pie.tsx`): the
  `--border` circle (#232830) on the card surface (#14171C) is very low
  contrast. Not checked visually.
- `MANAGE_LINK_CLASS` (`app/dashboard/page.tsx`) mimics `Button
  variant="secondary"` but has no `min-h-11`, so those links are shorter than
  real Buttons now.

### Later, not design
- Currency decimals are inconsistent: `Money` (cash, net worth, portfolio)
  shows 2; `lib/assets.ts` `formatAssetMoney`, `app/net-worth-trend.tsx`
  `money()`, and `lib/rules.ts` `formatAmount` show 0.
- `Money` edge cases (figures left as text because `Money` can't render them):
  0-decimal asset ranges / `formatSignedMoney`; the unrealized-gain line in
  `app/net-worth-view.tsx`; `signedMoney()` / "Cost ..." and the nullable
  per-holding market value in `app/portfolio/portfolio-view.tsx`; holdings'
  per-share cost basis; the loan "Orig ..." line and "Estimated balance
  today" preview in liabilities; `formatAmount()` in `app/reminders/page.tsx`.
  Also: `Money` prints a symbol prefix and hyphen-minus where the old text
  said `1,234.00 TWD` and used U+2212.
- Dashboard per-category rows and vs-last-month delta assume one currency
  (`SPENDING_CURRENCY = "TWD"`).
- The 6 pre-existing `react-hooks/set-state-in-effect` lint errors (see
  Conventions).

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

**Built and working:** the app renamed from "Finance App" to "MoneyLeft" in
every user-facing spot — the login heading, the browser tab title/description
(`app/layout.tsx`, previously still the unedited Next.js scaffold defaults),
and a wordmark-adjacent logo mark (`components/ui/Logo.tsx`, exported from
`components/ui`) — an M/L monogram, two bezier `<path>`s meeting at one point
so it reads as a single continuous stroke with a colour changeover
(`--text` to `--pos`), no fill/gradient/container; stroke width is a
size-derived value via the `size` prop (thicker at icon scale, thinner at
display scale), rendered only on `/login`. The `/login` wordmark itself is
set in Space Grotesk bold (`app/layout.tsx`'s `spaceGrotesk`, exposed as the
`font-wordmark` token in `globals.css`'s `@theme inline` block) — loaded via
`next/font`, bold weight only, used nowhere else in the app — sized with a
`clamp()`-based fluid `font-size` on the mark+wordmark's shared wrapper so
the lockup's rendered width tracks the login card's own width (which is
itself fluid below the `max-w-sm` cap, fixed at/above it), keeping the
lockup matched to the email/password input width at any viewport. GitHub
repo, `package.json`'s `name`, and the Vercel project deliberately were not
renamed. Migration file headers still say "Finance App" in places -
internal/historical text, not user-facing, left alone; `SETUP.md` (which
also still said "Finance App," among other now-stale claims) was deleted
outright rather than fixed, superseded by `README.md`; the net
worth page (liquid/illiquid/liabilities, FX
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
- Phase 1 token migration is complete (batches A-D). Next is Phase 2, the
  visual re-skin; see "Phase 2" and "Later, not design" under the Token
  migration checklist.
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
