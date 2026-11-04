-- Migration: visa decision workflow (Historique sub-page)
--
-- Adds the final decision on a visa request — separate from the existing
-- `status` column, which only ever tracked the application form itself
-- (e.g. "soumis"). A visa request is never auto-approved: `decision_status`
-- starts at 'en_attente' and only ever moves to 'obtenu' or 'rejete' through
-- the demo-only `simulateVisaDecision` action (app/actions/visa.ts) — this
-- app has no real government/authority integration. `decided_at` records
-- when that decision was made, and `expires_at` is only ever set when the
-- visa was obtained (its validity end date). Backs the new "/visas/
-- historique" page (beneficiaries + obtention/expiration dates).
--
-- Run this against a database that already has supabase/visa-schema.sql
-- applied. Safe to re-run: every statement uses `add column if not exists`.
-- ---------------------------------------------------------------------------

alter table public.visa_application
  add column if not exists decision_status text not null default 'en_attente';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'visa_application_decision_status_check'
  ) then
    alter table public.visa_application
      add constraint visa_application_decision_status_check
      check (decision_status in ('en_attente', 'obtenu', 'rejete'));
  end if;
end $$;

alter table public.visa_application
  add column if not exists decided_at timestamptz;

alter table public.visa_application
  add column if not exists expires_at timestamptz;
