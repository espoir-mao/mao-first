-- Migration: société license history + decoupled license attribution
--
-- Validating a société request (choosing the retained name) no longer
-- issues the trade license in the same step — license attribution is now a
-- separate action on "/backoffice/licences" (see issueSocieteLicense /
-- renewSocieteLicense in app/actions/societes.ts), so every license can be
-- attributed or renewed at its own time and by its own history entry. This
-- adds the column that stores that history.
--
-- Run this against a database that already has supabase/schema.sql and the
-- earlier migrations (0001, 0002) applied. Safe to re-run: every statement
-- uses `add column if not exists`.
-- ---------------------------------------------------------------------------

alter table public.societes
  add column if not exists license_history jsonb not null default '[]'::jsonb;
