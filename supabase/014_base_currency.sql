-- ============================================================================
-- Finance App - migration 014: explicit base currency for onboarding money fields
--
-- user_profiles.preferred_currency: the currency the user "thinks in", set at
-- onboarding. This is BASE currency (what a stored number means, near-
-- immutable), not display currency (a read-time lens) - the display toggle is
-- a later phase and does not exist yet.
--
-- user_rules.currency: the currency each individual rule's amount was actually
-- entered in. Kept separate from preferred_currency because a rule can outlive
-- a later change to the user's preference.
--
-- Both default to 'TWD', matching what the app code was already silently
-- assuming everywhere it read a user_rules.amount or treated a savings target
-- as TWD - so no existing row's meaning changes, it is just written down now.
--
-- Plain ALTER, no enum/CHECK - matches every other currency column in this
-- schema (cash_accounts, assets, holdings, transactions, recurring_transactions).
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.user_profiles add column if not exists preferred_currency text not null default 'TWD';
alter table public.user_rules     add column if not exists currency           text not null default 'TWD';

-- ============================================================================
-- VERIFICATION - both rows should show column_default = 'TWD'::text
-- ============================================================================
select table_name, column_name, column_default
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'user_profiles' and column_name = 'preferred_currency')
    or (table_name = 'user_rules' and column_name = 'currency'));
