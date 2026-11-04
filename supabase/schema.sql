-- Sociétés Manager schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

create table if not exists public.societes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  structure_type text not null check (structure_type in ('mainland', 'freezone', 'offshore')),
  free_zone_id text,
  free_zone_name text,
  free_zone_emirate text,
  activity_category text not null,
  activity_description text not null,
  company_name_1 text not null,
  company_name_2 text not null,
  company_name_3 text not null,
  shareholders jsonb not null default '[]',
  accounting boolean not null default false,
  documents jsonb not null default '[]'
);

alter table public.societes enable row level security;

-- ---------------------------------------------------------------------------
-- DEMO POLICIES ONLY — these allow the public "anon" key to fully read and
-- write this table with no restrictions, which is fine for a quick demo or
-- personal project but is NOT safe for a real production app with multiple
-- users. Before shipping this for real, replace these policies with ones
-- scoped to an authenticated user, e.g. by adding a `user_id uuid references
-- auth.users(id)` column and writing policies like
-- `using (auth.uid() = user_id)` / `with check (auth.uid() = user_id)`.
-- ---------------------------------------------------------------------------

create policy "Demo: anyone can read societes"
  on public.societes for select
  to anon, authenticated
  using (true);

create policy "Demo: anyone can insert societes"
  on public.societes for insert
  to anon, authenticated
  with check (true);

create policy "Demo: anyone can update societes"
  on public.societes for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Demo: anyone can delete societes"
  on public.societes for delete
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Supabase Storage bucket for uploaded documents (PDF / PNG / JPG) attached
-- to a société. See supabase/storage-setup.sql for the bucket creation and
-- its own set of (also permissive, demo-only) policies.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Migration: société request tracking + licensing
--
-- Adds the review workflow (nouveau -> soumis -> valide), a tracking
-- reference, the requester's name, the validated company name, the
-- generated trade license, and the mock license-renewal support tickets.
-- Safe to re-run: every statement uses `add column if not exists`.
--
-- NOTE: a société creation request is never auto-approved. "valide" is only
-- ever reached through the demo-only simulation action
-- (validateSocieteRequest in app/actions/societes.ts) — this app has no
-- separate backend/admin interface, so that action stands in for what would
-- normally be a real government/authority review.
-- ---------------------------------------------------------------------------

alter table public.societes
  add column if not exists tracking_reference text;

alter table public.societes
  add column if not exists status text not null default 'nouveau';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'societes_status_check'
  ) then
    alter table public.societes
      add constraint societes_status_check
      check (status in ('nouveau', 'soumis', 'valide'));
  end if;
end $$;

alter table public.societes
  add column if not exists status_history jsonb not null default '[]';

alter table public.societes
  add column if not exists requester_name text;

alter table public.societes
  add column if not exists validated_company_name text;

alter table public.societes
  add column if not exists license jsonb not null default '{}';

alter table public.societes
  add column if not exists license_renewal_tickets jsonb not null default '[]';

-- ---------------------------------------------------------------------------
-- Migration: shared support inbox
--
-- Backs both the "Contacts" page (a free-form message to the admin) and the
-- license renewal requests (see requestLicenseRenewal in
-- app/actions/societes.ts), so the "Support" page can list every request —
-- of either kind, across every société — in one place. Demo-only: no real
-- email/helpdesk system is wired up, this table *is* the mock inbox.
-- ---------------------------------------------------------------------------

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('contact', 'license_renewal')),
  reference text not null,
  subject text not null,
  message text not null default '',
  requester_name text,
  requester_email text,
  societe_id uuid references public.societes(id) on delete set null,
  societe_name text,
  status text not null default 'ouvert' check (status in ('ouvert', 'traite'))
);

alter table public.support_tickets enable row level security;

-- DEMO POLICIES ONLY — see the note above the société policies; same caveat
-- applies here (no per-user scoping, anon key can read/write everything).

create policy "Demo: anyone can read support_tickets"
  on public.support_tickets for select
  to anon, authenticated
  using (true);

create policy "Demo: anyone can insert support_tickets"
  on public.support_tickets for insert
  to anon, authenticated
  with check (true);

create policy "Demo: anyone can update support_tickets"
  on public.support_tickets for update
  to anon, authenticated
  using (true)
  with check (true);
