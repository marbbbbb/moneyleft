-- ============================================================================
-- Finance App — migration 004: persist valuation sources (web comps)
-- Run in Supabase → SQL Editor. Idempotent.
--
-- Adds a `sources` array to asset_valuations so AI/web-comp valuations can store
-- the links they were based on, for display and audit.
-- ============================================================================

alter table public.asset_valuations
  add column if not exists sources jsonb not null default '[]'::jsonb;
