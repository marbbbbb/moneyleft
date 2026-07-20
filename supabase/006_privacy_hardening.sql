-- ============================================================================
-- Finance App — migration 006: privacy hardening + verification
-- Run in Supabase → SQL Editor. Idempotent. Changes no functionality.
--
-- Purpose: guarantee that every user-data table has Row Level Security ON with
-- an owner-only policy, re-assert the photo bucket is private, and print a
-- report you can read to confirm it. Safe to re-run any time.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ensure RLS is ON for every user-data table (no-op where already enabled).
--    A single table without RLS would expose every user's rows in it.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'transactions','holdings','assets','asset_photos','asset_valuations',
    'cash_accounts','user_rules','user_profiles','notifications'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Safety net: if any of those tables has NO policy at all, add the standard
--    owner policy. Only fires where none exists, so it never duplicates or
--    clobbers the existing named policies.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'transactions','holdings','assets','asset_photos','asset_valuations',
    'cash_accounts','user_rules','user_profiles','notifications'
  ]
  loop
    if not exists (
      select 1 from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t
    ) then
      execute format(
        'create policy "Owner full access" on public.%I
           for all to authenticated
           using (auth.uid() = user_id)
           with check (auth.uid() = user_id);', t);
      raise notice 'SECURITY: added missing owner policy on public.%', t;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Re-assert the asset photo bucket is private (never publicly served).
-- ---------------------------------------------------------------------------
update storage.buckets set public = false where id = 'asset-photos';

-- ============================================================================
-- VERIFICATION — read the output of these three queries.
-- ============================================================================

-- (a) Every table must show rls_enabled = true and policy_count >= 1.
--     Anything with rls_enabled = false sorts to the TOP and is a live leak.
select
  c.relname                             as table_name,
  c.relrowsecurity                      as rls_enabled,
  count(p.polname)                      as policy_count,
  coalesce(
    string_agg(distinct pg_get_expr(p.polqual, p.polrelid), ' | '),
    '(NO POLICY)'
  )                                     as owner_check
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relrowsecurity asc, c.relname;

-- (b) The "latest valuation" view must run as the CALLER, not its owner —
--     otherwise it would bypass RLS. Expect: {security_invoker=on}
select relname as view_name, reloptions
from pg_class
where relname = 'asset_current_valuations';

-- (c) The photo bucket must be private. Expect: public = false
select id, public from storage.buckets where id = 'asset-photos';
