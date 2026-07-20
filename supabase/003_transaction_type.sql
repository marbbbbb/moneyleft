-- ============================================================================
-- Finance App — migration 003: income vs expense on transactions
-- Run in Supabase → SQL Editor. Idempotent.
--
-- Existing rows backfill to 'expense' (the NOT NULL DEFAULT), which matches the
-- original spending-only behaviour.
-- ============================================================================

do $$ begin
  create type transaction_type as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

alter table public.transactions
  add column if not exists type transaction_type not null default 'expense';
