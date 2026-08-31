# MoneyLeft

A personal net worth tracker. It splits what you own into liquid and
illiquid wealth, values illiquid assets (collectibles, vehicles, gold, and
similar) with live market data where it exists and an AI estimate where it
doesn't, and tracks a running day-to-day cash balance alongside spending.

Live: [moneyleft.vercel.app](https://moneyleft.vercel.app)

Click "View demo" on the login page to explore the app with sample data,
no sign-up required.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript, Turbopack), React 19
- [Tailwind CSS](https://tailwindcss.com) v4
- [Supabase](https://supabase.com) - Postgres + auth, with Row Level Security
- [Anthropic API](https://www.anthropic.com/api) (`claude-haiku-4-5`) - asset
  valuation estimates and spending-rule reminders
- [Yahoo Finance](https://finance.yahoo.com) - stock prices, gold spot, and
  FX rates
- Deployed on Vercel, auto-deploying every push to `main`

## Features

- Email/password auth, with a public demo account for browsing without
  signing up
- Net worth view: liquid vs. illiquid wealth, total liabilities, an
  FX toggle, and a historical trend chart
- Asset vault: cash accounts, brokerage holdings, and physical/illiquid
  assets (collectibles, vehicles, metals, etc.), each valued from market
  data where available and an AI estimate otherwise, always as a low/high
  range with a stated confidence and source
- Liabilities, including amortizing loans with a computed running balance
- Transactions, including recurring ones, with per-category spending
  tracking
- A running cash balance ("Money left") since the last time balances were
  manually confirmed
- A user-defined spending plan (limit, savings target, category limits)
  with AI-generated, non-judgmental reminders when a rule is crossed
- Multi-currency entry (TWD and USD), with a chosen base currency per user
- Mobile-first, with a bottom tab bar for navigation

## Design decisions

**Cash is a manually confirmed balance, not derived from linked accounts.**
There is no bank integration. The user periodically enters what their cash
balance actually is; the app trusts that number and layers transactions on
top of it going forward, rather than trying to reconstruct a balance from a
transaction history that will always be incomplete for cash.

**The running balance counts from a confirmed date instead of resetting
monthly.** A calendar-month reset throws away real information: it snaps
back to the full cash balance every 1st regardless of what actually
happened, and ignores income entirely. Counting income and expenses since
the last confirmed balance, with no upper bound, gives a number that
reflects reality between confirmations instead of an arbitrary calendar
boundary.

**Amounts are stored in their entry currency and converted only at display
time.** Storing a converted number bakes in whatever exchange rate happened
to be current at save time, which drifts from reality the moment rates
move and can't be corrected retroactively without guessing. Storing the
original currency and amount keeps the record itself factual; conversion
using a live rate happens only when something needs to be displayed or
summed in a single currency.

**The currency layer is data-driven but ships with only TWD and USD.**
Supported currencies are a single list, not scattered enum values or
hardcoded branches, so adding one is meant to be one new entry. Only two
are populated because that's what's actually needed and verified right
now; the data-driven shape means widening it later doesn't require
touching the logic, only the data.

**The net worth page and the dashboard share one cash calculation instead
of two.** Both surfaces need "how much cash does the user actually have
right now," and computing that independently in two places is how the two
numbers quietly drift apart over time. There is one function; both pages
call it.

## Running locally

Prerequisites: Node.js, a Supabase project, and an Anthropic API key.

Environment variables (set in `.env.local`; never commit real values):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `DEMO_EMAIL` (optional - enables the "View demo" button on `/login`)
- `DEMO_PASSWORD` (optional - paired with `DEMO_EMAIL`)

Install and run:

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

Database schema lives in `supabase/` as flat, numbered SQL files, not in a
`supabase/migrations/` folder Supabase CLI would apply automatically. Run
`schema.sql` first, then each numbered migration in order, by hand, in the
Supabase SQL Editor.

## Screenshots


**Home**

<img width="600" alt="Screenshot 2026-08-20 at 4 36 01 PM" src="https://github.com/user-attachments/assets/e338cd20-a5e0-41d9-ae66-e25d1ec5e9fc" />



**Transactions**

<img width="600" alt="Screenshot 2026-08-20 at 4 36 23 PM" src="https://github.com/user-attachments/assets/33d9facb-8a40-4442-99c6-ad2689362fe3" />



**Net worth**

<img width="600" alt="Screenshot 2026-08-20 at 4 39 49 PM" src="https://github.com/user-attachments/assets/d0891e6d-5f7a-4057-91bc-f5b755a107d7" />



