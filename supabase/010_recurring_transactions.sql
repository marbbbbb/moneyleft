-- ============================================================================
-- Finance App — migration 010: recurring transactions
-- Run in Supabase → SQL Editor. Idempotent.
--
-- A recurring_transaction is a TEMPLATE. Actual transactions are materialized
-- from it each period (server-side catch-up), so rent/subscriptions/salary
-- auto-create instead of being re-entered.
-- ============================================================================

do $$ begin
  create type recurrence_frequency as enum ('weekly', 'monthly', 'yearly');
exception when duplicate_object then null; end $$;

create table if not exists public.recurring_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  amount     numeric(14,2) not null,
  category   text not null,
  note       text,
  type       transaction_type not null default 'expense',
  currency   text not null default 'USD',
  frequency  recurrence_frequency not null,
  next_run   date not null,          -- the next date an occurrence should be created
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_active_idx
  on public.recurring_transactions (user_id, next_run)
  where is_active;

drop trigger if exists set_updated_at on public.recurring_transactions;
create trigger set_updated_at before update on public.recurring_transactions
  for each row execute function public.set_updated_at();

alter table public.recurring_transactions enable row level security;
drop policy if exists "Owner full access" on public.recurring_transactions;
create policy "Owner full access" on public.recurring_transactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- VERIFICATION — expect rls_enabled = true, policy_count = 1.
-- ============================================================================
select c.relname as table_name, c.relrowsecurity as rls_enabled, count(p.polname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relname = 'recurring_transactions'
group by c.relname, c.relrowsecurity;
