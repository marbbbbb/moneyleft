-- ============================================================================
-- Finance App — migration 005: make "latest valuation" correct and deterministic
-- Run in Supabase → SQL Editor. Idempotent.
--
-- Bug: the purchase seed stored `valued_at` as a date-only value, which Postgres
-- reads as midnight UTC. For a user ahead of UTC (e.g. Taipei, UTC+8), a purchase
-- dated "today" in their local date-picker lands in the FUTURE relative to now(),
-- so that row outranked every real valuation in `order by valued_at desc` and was
-- shown as the current value.
--
-- Fixes: (1) repair rows already written in the future, (2) add a deterministic
-- tiebreak so rows sharing a valued_at resolve by when they were recorded.
-- ============================================================================

-- 1. Repair existing future-dated rows. A valuation can't be "as of" a moment
--    later than when it was recorded, so fall back to created_at — which keeps
--    the purchase seed correctly *behind* any later estimate.
update public.asset_valuations
set valued_at = created_at
where valued_at > now();

-- 2. Deterministic latest-per-asset: same valued_at resolves by created_at, then
--    id, so the newest recorded row always wins instead of an arbitrary one.
create or replace view public.asset_current_valuations
with (security_invoker = on) as
select distinct on (asset_id)
  asset_id, user_id, value_low, value_high, currency, confidence, source, valued_at
from public.asset_valuations
order by asset_id, valued_at desc, created_at desc, id desc;
