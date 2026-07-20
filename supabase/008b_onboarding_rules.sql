-- ============================================================================
-- Finance App — migration 008b: shared AI credit + reminder index (STEP 2 OF 2)
--
-- ⚠️ Run 008a_rule_type_enum.sql FIRST and let it commit. The guard below will
--    stop with a clear message if you haven't.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Guard: confirm 008a has been committed.
-- Reads the pg_enum catalog as text, which is always safe — it never "uses" the
-- enum value in an expression, which is what triggers error 55P04.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'rule_type' and e.enumlabel = 'monthly_savings_target'
  ) then
    raise exception
      'Run 008a_rule_type_enum.sql first (and let it finish) before running this file.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Generalise the daily AI cap from 007.
-- AI reminders and AI valuations now share ONE per-user daily budget, so the cap
-- bounds total Anthropic spend per user rather than per feature. Same table,
-- same limit, same protection: the limit is hardcoded (not a parameter) so it
-- can't be raised by calling this directly from the browser.
-- ---------------------------------------------------------------------------
create or replace function public.consume_ai_credit()
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

  insert into public.ai_valuation_usage (user_id, day, used_count)
  values (v_user, current_date, 0)
  on conflict (user_id, day) do nothing;

  -- Ordinary UPDATE = row lock; a concurrent call blocks then re-checks
  -- used_count against the committed value, so the cap can't be raced past.
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

revoke all on function public.consume_ai_credit() from public;
grant execute on function public.consume_ai_credit() to authenticated;

-- Keep the 007 name working as a thin wrapper so nothing breaks.
create or replace function public.consume_ai_valuation_credit()
returns table (allowed boolean, used integer, daily_limit integer)
language sql
security definer
set search_path = public, pg_temp
as $$ select * from public.consume_ai_credit(); $$;

revoke all on function public.consume_ai_valuation_credit() from public;
grant execute on function public.consume_ai_valuation_credit() to authenticated;

-- ---------------------------------------------------------------------------
-- Reminders are deduped by (rule_id, month), so index the lookup.
-- ---------------------------------------------------------------------------
create index if not exists notifications_rule_created_idx
  on public.notifications (user_id, rule_id, created_at desc);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Should list monthly_savings_target among the rule types.
select e.enumlabel as rule_type_values
from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'rule_type'
order by e.enumsortorder;

-- Both should show security_definer = true.
select proname, prosecdef as security_definer
from pg_proc
where proname in ('consume_ai_credit', 'consume_ai_valuation_credit')
order by proname;
