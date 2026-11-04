-- Migration: société rejection reason + support-driven review
--
-- The société review workflow ("nouveau" -> "soumis" -> "valide"/"rejete")
-- moves from the requester's own page to the support team: validation and
-- rejection (with a reason) are now only ever done from "/support" (see
-- validateSocieteRequest / rejectSocieteRequest in app/actions/societes.ts).
-- This adds the "rejete" status and the column that holds the support
-- team's reason when they reject a request.
--
-- Run this against a database that already has supabase/schema.sql applied
-- (including the earlier société request-tracking migration block at its
-- end). Safe to re-run: every statement uses `add column if not exists`.
-- ---------------------------------------------------------------------------

alter table public.societes
  add column if not exists rejection_reason text;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'societes_status_check'
  ) then
    alter table public.societes drop constraint societes_status_check;
  end if;

  alter table public.societes
    add constraint societes_status_check
    check (status in ('nouveau', 'soumis', 'valide', 'rejete'));
end $$;
