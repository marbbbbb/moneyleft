-- ============================================================================
-- Finance App — migration 013: default transaction currency to TWD
--
-- transactions.currency and recurring_transactions.currency were added in 002
-- with `default 'USD'`, but this app's real primary currency is TWD. The app
-- now always sends an explicit currency from the transaction form, so this
-- default is only a safety net for any row that somehow bypasses it — not the
-- primary mechanism. Existing rows are untouched; this only changes what new
-- rows get if no currency is supplied.
--
-- Run this AFTER you've cleared out test data (see the separate DELETE
-- statement Claude gave you — that is NOT part of this file and is not run
-- here).
--
-- Plain ALTER, no enum/CHECK — matches every other currency column in this
-- schema (cash_accounts, assets, holdings, transactions itself), none of which
-- constrain the value beyond `text not null default '...'`.
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.transactions          alter column currency set default 'TWD';
alter table public.recurring_transactions alter column currency set default 'TWD';

-- ============================================================================
-- VERIFICATION — both rows should show column_default = 'TWD'::text
-- ============================================================================
select table_name, column_name, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('transactions', 'recurring_transactions')
  and column_name = 'currency';
