# Finance App — setup

A Next.js 16 (App Router) + Supabase app with email/password auth and two
user-scoped tables: `transactions` and `holdings`.

## What's already done

- Next.js + TypeScript + Tailwind scaffolded
- `@supabase/supabase-js` + `@supabase/ssr` wired up
- `.env.local` holds your Supabase URL + publishable key (git-ignored)
- Email/password sign-up + login (`/login`)
- Route protection via `proxy.ts` (Next 16's renamed middleware)
- `/dashboard` confirms both tables are connected and scoped to you

## Steps you need to do (once)

### 1. Create the tables + security policies

Supabase Dashboard → **SQL Editor** → **New query** → paste the contents of
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.

This creates both tables with **Row Level Security** so every user only ever
sees their own rows.

### 2. Point auth at your local app

Dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000/**`

### 3. (For now) turn off email confirmation so testing is instant

Dashboard → **Authentication** → **Sign In / Providers** → **Email** →
turn **Confirm email** OFF → Save.

With it off, signing up logs you straight in. When you're ready to onboard real
users, turn it back on — the app already has an `/auth/confirm` route to handle
the confirmation link. You'll then also set the confirmation email template's
link to:
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

## Run it

```bash
npm run dev
```

Open http://localhost:3000 → you'll be sent to `/login` → **Sign up** with any
email + password (min 6 chars) → you land on `/dashboard` showing both tables as
`✓ connected`.
