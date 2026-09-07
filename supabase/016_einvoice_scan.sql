-- ============================================================================
-- MoneyLeft - migration 016: e-invoice (dian zi fa piao) fields on transactions
--
-- Lets a transaction be created by scanning the QR code on a Taiwanese
-- e-invoice proof slip instead of typing it. Every new column is NULLABLE and
-- is only written on the scan path - the manual add-transaction flow writes
-- none of them and is completely unaffected.
--
--   einvoice_number       invoice number, 2 uppercase letters + 8 digits
--   einvoice_date         the invoice's own printed date (Gregorian, converted
--                         from the ROC/Minguo date in the QR)
--   einvoice_random_code  4-digit verification code from the QR
--   einvoice_seller_id    seller tax ID, 8 chars
--   source                how the row was created: 'manual' (default) or
--                         'qr_scan'. Plain text + CHECK, no enum - this is the
--                         convention CLAUDE.md calls for on a fixed small
--                         vocabulary (never create/extend an enum in a
--                         migration that also uses it).
--
-- The PARTIAL unique index on (user_id, einvoice_number) stops the same
-- physical receipt being scanned into two transactions. It is partial
-- (WHERE einvoice_number IS NOT NULL) so it never touches manually-added rows,
-- which all have NULL there and can coexist freely.
--
-- Plain ALTERs, all IF NOT EXISTS. Idempotent: safe to re-run.
-- NOT yet applied to production - run it yourself in the Supabase SQL Editor.
-- ============================================================================

alter table public.transactions
  add column if not exists einvoice_number      text,
  add column if not exists einvoice_date        date,
  add column if not exists einvoice_random_code text,
  add column if not exists einvoice_seller_id   text,
  add column if not exists source               text not null default 'manual';

do $$ begin
  alter table public.transactions
    add constraint transactions_source_check
    check (source in ('manual', 'qr_scan', 'photo', 'einvoice_api', 'csv_import'));
exception when duplicate_object then null; end $$;

create unique index if not exists transactions_user_einvoice_number_uq
  on public.transactions (user_id, einvoice_number)
  where einvoice_number is not null;

-- ============================================================================
-- VERIFICATION - expect the 5 new columns, then one unique-index row.
-- ============================================================================
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transactions'
  and column_name in (
    'einvoice_number', 'einvoice_date', 'einvoice_random_code',
    'einvoice_seller_id', 'source'
  )
order by column_name;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'transactions'
  and indexname = 'transactions_user_einvoice_number_uq';
