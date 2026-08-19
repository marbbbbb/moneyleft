-- ============================================================================
-- Finance App - migration 015: cash_confirmed_at for the dashboard's running
-- balance ("Money left")
--
-- One column, on user_profiles (one row per user), not per cash_accounts row:
-- transactions are not linked to individual cash accounts, so a per-account
-- "last confirmed" date would be unattributable. A single user-level date
-- means "I last checked my accounts on this day", which is exactly what the
-- running-balance formula needs: cash + income since this date - expenses
-- since this date.
--
-- DEFAULT now() is deliberate. Existing users' currently-typed cash balances
-- already reflect everything they have spent up to today, so counting past
-- transactions against them would double-subtract what is already baked into
-- the typed balance. Defaulting to now() starts the running balance clean
-- from today rather than re-litigating history.
--
-- Plain ALTER, no enum/CHECK - matches every other schema addition here.
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.user_profiles
  add column if not exists cash_confirmed_at timestamptz not null default now();

-- ============================================================================
-- VERIFICATION - should show column_default containing now()
-- ============================================================================
select table_name, column_name, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_profiles'
  and column_name = 'cash_confirmed_at';
