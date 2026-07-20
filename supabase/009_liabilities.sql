-- ============================================================================
-- Finance App — migration 009: liabilities (debts)
-- Run in Supabase → SQL Editor. Idempotent.
--
-- Net worth becomes assets minus debts. A brand-new enum used in the same
-- statement that creates it is fine (the 55P04 restriction only applies to
-- ALTER TYPE ... ADD VALUE on an existing enum).
-- ============================================================================

do $$ begin
  create type liability_type as enum
    ('mortgage', 'car_loan', 'student_loan', 'credit_card', 'personal_loan', 'other');
exception when duplicate_object then null; end $$;

create table if not exists public.liabilities (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name           text not null,
  liability_type liability_type not null default 'other',
  balance        numeric(18,2) not null default 0,   -- current amount owed
  currency       text not null default 'USD',
  interest_rate  numeric(6,3),                        -- optional annual %, e.g. 5.250
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists liabilities_user_idx on public.liabilities (user_id);

-- updated_at trigger (public.set_updated_at was created in migration 002).
drop trigger if exists set_updated_at on public.liabilities;
create trigger set_updated_at before update on public.liabilities
  for each row execute function public.set_updated_at();

-- Row Level Security — owner only, same pattern as every other table.
alter table public.liabilities enable row level security;
drop policy if exists "Owner full access" on public.liabilities;
create policy "Owner full access" on public.liabilities
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
where n.nspname = 'public' and c.relname = 'liabilities'
group by c.relname, c.relrowsecurity;
