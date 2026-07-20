-- ============================================================================
-- Finance App — migration 007: per-user daily cap on AI valuations
-- Run in Supabase → SQL Editor. Idempotent.
--
-- Protects the Anthropic bill: one user cannot run up cost by clicking
-- "Estimate current value" repeatedly. Enforced entirely in the database, so it
-- cannot be bypassed from the browser.
--
-- Only AI-backed estimates count. Gold (live spot price) and vehicle
-- (depreciation maths) call no paid API, so they stay unlimited.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Counter: one row per user per (UTC) day.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_valuation_usage (
  user_id    uuid    not null references auth.users(id) on delete cascade,
  day        date    not null default current_date,
  used_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.ai_valuation_usage enable row level security;

-- Owner may READ their own usage — and nothing else.
-- There is deliberately NO insert/update/delete policy: if users could write to
-- this table they could simply reset their own counter to zero. All writes go
-- through the security-definer function below.
drop policy if exists "Owner reads own usage" on public.ai_valuation_usage;
create policy "Owner reads own usage" on public.ai_valuation_usage
  for select to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Atomically consume one credit for the calling user. Returns whether the call
-- is allowed, how many are used today, and the limit.
--
-- The limit is hardcoded here on purpose — it is NOT a parameter. A parameter
-- could be overridden by calling this endpoint directly from the browser with a
-- huge value, which would defeat the cap. Calling this directly can only ever
-- spend your own credits, never raise the ceiling.
-- ---------------------------------------------------------------------------
create or replace function public.consume_ai_valuation_credit()
returns table (allowed boolean, used integer, daily_limit integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  uuid := auth.uid();
  v_limit constant integer := 20;
  v_count integer;
begin
  if v_user is null then
    return query select false, 0, v_limit;
    return;
  end if;

  -- Step 1: make sure today's counter row exists (starts at zero).
  insert into public.ai_valuation_usage (user_id, day, used_count)
  values (v_user, current_date, 0)
  on conflict (user_id, day) do nothing;

  -- Step 2: increment only while under the limit. This is an ordinary UPDATE,
  -- so it takes a row lock; a concurrent call blocks, then re-evaluates
  -- `used_count < v_limit` against the committed value (READ COMMITTED
  -- behaviour). Two simultaneous clicks therefore cannot both slip through at
  -- the boundary. If no row matches, the user is at the limit and RETURNING
  -- yields nothing, leaving v_count NULL.
  update public.ai_valuation_usage
  set used_count = used_count + 1,
      updated_at = now()
  where user_id = v_user
    and day = current_date
    and used_count < v_limit
  returning used_count into v_count;

  if v_count is null then
    select u.used_count into v_count
    from public.ai_valuation_usage u
    where u.user_id = v_user and u.day = current_date;
    return query select false, coalesce(v_count, v_limit), v_limit;
    return;
  end if;

  return query select true, v_count, v_limit;
end $$;

-- Only signed-in users may spend credits.
revoke all on function public.consume_ai_valuation_credit() from public;
grant execute on function public.consume_ai_valuation_credit() to authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Usage table must show rls_enabled = true with exactly one SELECT policy.
select c.relname as table_name, c.relrowsecurity as rls_enabled, count(p.polname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relname = 'ai_valuation_usage'
group by c.relname, c.relrowsecurity;

-- Function must be security definer (prosecdef = true).
select proname, prosecdef as security_definer
from pg_proc
where proname = 'consume_ai_valuation_credit';

-- ============================================================================
-- OPTIONAL: prove the cap works, without clicking Estimate 20 times.
--
--   1. Find your user id:
--        select id, email from auth.users;
--
--   2. Pretend you've already used today's allowance (paste your id):
--        insert into public.ai_valuation_usage (user_id, day, used_count)
--        values ('YOUR-USER-ID', current_date, 20)
--        on conflict (user_id, day) do update set used_count = 20;
--
--   3. In the app, click "Estimate current value" on a watch/card/art asset.
--      Expect: "You've reached today's estimate limit…" and NO API call.
--
--   4. Reset yourself back to normal:
--        delete from public.ai_valuation_usage
--        where user_id = 'YOUR-USER-ID' and day = current_date;
--
-- To watch it climb during normal use:
--   select * from public.ai_valuation_usage order by day desc;
-- ============================================================================
