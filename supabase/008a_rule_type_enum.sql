-- ============================================================================
-- Finance App — migration 008a: add the new rule type (STEP 1 OF 2)
--
-- ⚠️ Run this file BY ITSELF and let it finish before running 008b.
--
-- Postgres will not let a new enum value be *used* in the same transaction that
-- adds it (error 55P04). The Supabase SQL editor runs a whole file as one
-- transaction, so adding the value and referencing it must be two separate runs.
--
-- This file contains exactly one statement and uses the new value nowhere.
-- Idempotent: safe to re-run.
-- ============================================================================

alter type rule_type add value if not exists 'monthly_savings_target';
