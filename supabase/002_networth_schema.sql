-- ============================================================================
-- Finance App — Net Worth schema (migration 002)
--
-- Builds ON TOP OF schema.sql (transactions + holdings, already created).
-- Run in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- Design notes:
--  * Everything is multi-currency (US stocks in USD, TWSE like 0056 in TWD).
--    Each money row carries its own `currency`; net worth converts to the
--    user's `base_currency` at read time in the app layer.
--  * Asset values are a TIME SERIES (asset_valuations): a range (low/high) +
--    confidence + timestamp, never a single fake-precise number. The "current"
--    value of an asset is simply its most recent valuation.
--  * Liquid vs illiquid net worth is derivable: cash_accounts + holdings are
--    liquid; assets are illiquid by default (per-row override via is_liquid).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enum types (idempotent via duplicate_object guard)
-- ---------------------------------------------------------------------------
do $$ begin
  create type asset_category as enum
    ('real_estate','vehicle','precious_metal','jewelry','watch',
     'collectible','trading_card','art','antique','electronics','clothing','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type valuation_confidence as enum ('low','medium','high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type valuation_source as enum ('ai_estimate','manual','appraisal','market');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cash_account_type as enum
    ('checking','savings','cash','money_market','brokerage_cash','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rule_type as enum
    ('monthly_spending_cap','category_spending_cap','savings_rate_target',
     'max_single_transaction','custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rule_period as enum ('daily','weekly','monthly','yearly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_severity as enum ('info','warning','alert');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- user_profiles: base currency + onboarding-quiz output (1 row per user)
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id                 uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  base_currency           text not null default 'USD',      -- net worth is reported in this
  display_name            text,
  monthly_income          numeric(16,2),
  savings_rate_target     numeric(5,2),                     -- e.g. 20.00 = target saving 20%
  risk_tolerance          text,                             -- from onboarding quiz
  onboarding              jsonb not null default '{}'::jsonb,  -- raw quiz answers
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- cash_accounts: LIQUID holdings (bank balances, physical cash)
-- ---------------------------------------------------------------------------
create table if not exists public.cash_accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name         text not null,
  account_type cash_account_type not null default 'checking',
  institution  text,
  balance      numeric(18,2) not null default 0,
  currency     text not null default 'USD',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- assets: the ILLIQUID vault (real estate, cars, gold, cards, ...)
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name             text not null,
  category         asset_category not null default 'other',
  description      text,
  quantity         numeric(18,4) not null default 1,       -- e.g. 10 gold coins
  acquisition_date date,
  acquisition_cost numeric(18,2),                          -- what the user paid
  currency         text not null default 'USD',            -- currency of acquisition_cost
  is_liquid        boolean not null default false,         -- override for near-cash assets (e.g. gold)
  details          jsonb not null default '{}'::jsonb,     -- per-category fields: mileage, purity, grade, address...
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- asset_photos: image references (files live in the 'asset-photos' bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.asset_photos (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid not null references public.assets(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  storage_path text not null,     -- object key, convention: {user_id}/{asset_id}/{filename}
  caption      text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- asset_valuations: TIME SERIES of values — range + confidence + timestamp
-- ---------------------------------------------------------------------------
create table if not exists public.asset_valuations (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.assets(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  value_low  numeric(18,2) not null,
  value_high numeric(18,2) not null,
  currency   text not null default 'USD',
  confidence valuation_confidence not null default 'medium',
  source     valuation_source not null default 'ai_estimate',
  rationale  text,                     -- AI explanation of how it reached the range
  valued_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint valuation_range_ok check (value_high >= value_low)
);

-- ---------------------------------------------------------------------------
-- user_rules: onboarding sets these; notifications evaluate against them
-- ---------------------------------------------------------------------------
create table if not exists public.user_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  rule_type   rule_type not null,
  description text,                     -- human-readable ("Keep dining under $300/mo")
  category    text,                     -- for category_spending_cap
  amount      numeric(18,2),            -- threshold (cap amount, or % for savings_rate_target)
  period      rule_period default 'monthly',
  params      jsonb not null default '{}'::jsonb,  -- extra machine-readable config
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notifications: AI messages, e.g. when a rule is broken
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  rule_id    uuid references public.user_rules(id) on delete set null,
  title      text not null,
  body       text,
  severity   notification_severity not null default 'info',
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Multi-currency on the EXISTING tables (US vs TWSE prices differ by currency)
-- ---------------------------------------------------------------------------
alter table public.holdings     add column if not exists currency text not null default 'USD';
alter table public.transactions add column if not exists currency text not null default 'USD';

-- ---------------------------------------------------------------------------
-- Indexes for the common access patterns
-- ---------------------------------------------------------------------------
create index if not exists cash_accounts_user_idx     on public.cash_accounts(user_id);
create index if not exists assets_user_idx            on public.assets(user_id);
create index if not exists asset_photos_asset_idx     on public.asset_photos(asset_id);
create index if not exists asset_valuations_asset_idx on public.asset_valuations(asset_id, valued_at desc);
create index if not exists user_rules_user_idx        on public.user_rules(user_id);
create index if not exists notifications_user_idx     on public.notifications(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['user_profiles','cash_accounts','assets','user_rules']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security — every table scoped to the owning user
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'user_profiles','cash_accounts','assets','asset_photos',
    'asset_valuations','user_rules','notifications'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "Owner full access" on public.%I;', t);
    execute format(
      'create policy "Owner full access" on public.%I
         for all to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Convenience view: the latest valuation per asset (RLS applies via invoker)
-- ---------------------------------------------------------------------------
create or replace view public.asset_current_valuations
with (security_invoker = on) as
select distinct on (asset_id)
  asset_id, user_id, value_low, value_high, currency, confidence, source, valued_at
from public.asset_valuations
order by asset_id, valued_at desc;

-- ---------------------------------------------------------------------------
-- Storage bucket for asset photos + owner-scoped policies (optional but ready)
-- Upload path convention: {user_id}/{asset_id}/{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('asset-photos', 'asset-photos', false)
on conflict (id) do nothing;

drop policy if exists "Owner reads asset photos"   on storage.objects;
drop policy if exists "Owner writes asset photos"  on storage.objects;
drop policy if exists "Owner deletes asset photos" on storage.objects;

create policy "Owner reads asset photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'asset-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owner writes asset photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'asset-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owner deletes asset photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'asset-photos' and (storage.foldername(name))[1] = auth.uid()::text);
