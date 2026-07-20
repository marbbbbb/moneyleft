-- ============================================================================
-- Finance App — database schema
-- Run this in the Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run: it uses IF NOT EXISTS / idempotent policy drops.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- transactions: budgeting / spending tracker
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  date       date        not null default current_date,
  amount     numeric(14, 2) not null,
  category   text        not null,
  note       text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- holdings: stock portfolio tracker
-- ---------------------------------------------------------------------------
create table if not exists public.holdings (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  ticker      text        not null,
  shares      numeric(18, 6) not null,
  cost_basis  numeric(14, 2) not null,
  date_bought date        not null default current_date,
  created_at  timestamptz not null default now()
);

-- Helpful indexes for the common "my rows" query pattern.
create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists holdings_user_id_idx      on public.holdings (user_id);

-- ============================================================================
-- Row Level Security — each user can only ever touch their own rows.
-- Without these policies, RLS-enabled tables return zero rows to everyone.
-- ============================================================================
alter table public.transactions enable row level security;
alter table public.holdings     enable row level security;

-- transactions policies
drop policy if exists "Users manage their own transactions" on public.transactions;
create policy "Users manage their own transactions"
  on public.transactions
  for all                                  -- select / insert / update / delete
  to authenticated
  using (auth.uid() = user_id)             -- which existing rows are visible
  with check (auth.uid() = user_id);       -- what rows may be written

-- holdings policies
drop policy if exists "Users manage their own holdings" on public.holdings;
create policy "Users manage their own holdings"
  on public.holdings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
