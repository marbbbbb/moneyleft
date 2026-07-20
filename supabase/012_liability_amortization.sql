-- ============================================================================
-- Finance App — migration 012: liability amortization
-- Run in Supabase → SQL Editor. Idempotent. NOT auto-applied — paste and run
-- this yourself.
--
-- Splits liabilities into two kinds:
--   'simple'     — balance is entered and edited by hand (unchanged behavior;
--                  every existing row defaults here and keeps working as-is).
--   'amortizing' — balance is DERIVED from loan terms (original principal,
--                  rate, term, start date) via lib/amortization.ts at read
--                  time, not stored.
--
-- `kind` is plain text + a CHECK constraint, not a Postgres enum — this repo
-- hit the "enum value must be committed before use" error (55P04) on
-- migration 008, so enums are avoided for any column both added and read back
-- in the same migration file.
--
-- All new columns are nullable except `kind` (NOT NULL DEFAULT 'simple'), so
-- every existing row stays valid and keeps rendering exactly as it does today.
--
-- `liability_type` (what the debt IS: mortgage, car_loan, ...) and `kind` (how
-- the balance BEHAVES: simple vs amortizing) are intentionally independent.
-- This migration does not touch the liability_type enum, does not add values
-- to it, and adds no constraint or relationship between the two columns — any
-- preselection between them is UI convenience only, enforced in the form, not
-- the database.
--
-- RLS is unchanged. The existing "Owner full access" policy from migration
-- 009 already covers every column on this table (it's a for-all policy keyed
-- on auth.uid() = user_id, not scoped to specific columns), so it is not
-- redefined here.
-- ============================================================================

alter table public.liabilities
  add column if not exists kind text not null default 'simple'
    check (kind in ('simple', 'amortizing'));

alter table public.liabilities
  add column if not exists original_principal numeric;

alter table public.liabilities
  add column if not exists term_months integer;

alter table public.liabilities
  add column if not exists start_date date;

alter table public.liabilities
  add column if not exists monthly_payment numeric;

alter table public.liabilities
  add column if not exists anchor_balance numeric;

alter table public.liabilities
  add column if not exists anchor_date date;

-- ============================================================================
-- VERIFICATION — confirm the columns landed with the right types/defaults/
-- nullability. `kind` should be the only NOT NULL column among the new ones.
-- ============================================================================
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'liabilities'
order by ordinal_position;
