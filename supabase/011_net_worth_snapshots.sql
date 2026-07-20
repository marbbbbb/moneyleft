-- ============================================================================
-- Finance App — migration 011: net worth snapshots (for the trend line)
-- Run in Supabase → SQL Editor. Idempotent.
--
-- Why this exists: cash_accounts and holdings only ever store CURRENT values —
-- there is no balance history table, and stock prices are fetched live, never
-- stored per-day. Only asset_valuations is a real time series. So a retroactive
-- "net worth over time" chart is not possible from existing data — this table
-- starts recording forward from today. Expect it to be sparse at first and fill
-- in day by day; nothing here is backfilled or fabricated.
--
-- One row per user per day (upserted), storing the multi-currency breakdown so
-- the trend chart can honor the same TWD/USD toggle as the rest of net worth.
-- ============================================================================

create table if not exists public.net_worth_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  snapshot_date date not null default current_date,
  total       jsonb not null,   -- {"USD": 12345.67, "TWD": 400000.00}
  liquid      jsonb not null,
  illiquid    jsonb not null,
  liabilities jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index if not exists net_worth_snapshots_user_date_idx
  on public.net_worth_snapshots (user_id, snapshot_date);

drop trigger if exists set_updated_at on public.net_worth_snapshots;
create trigger set_updated_at before update on public.net_worth_snapshots
  for each row execute function public.set_updated_at();

alter table public.net_worth_snapshots enable row level security;
drop policy if exists "Owner full access" on public.net_worth_snapshots;
create policy "Owner full access" on public.net_worth_snapshots
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
where n.nspname = 'public' and c.relname = 'net_worth_snapshots'
group by c.relname, c.relrowsecurity;
