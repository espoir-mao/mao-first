-- Visa Manager schema (parallel to supabase/schema.sql for the société
-- module). Run this in the Supabase SQL editor (Project > SQL Editor > New
-- query), after schema.sql (so the `societes` table it references exists).

create extension if not exists "pgcrypto";

create table if not exists public.visa_application (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  visa_type text not null check (
    visa_type in ('investor', 'employee', 'golden', 'family', 'domestic', 'remote')
  ),
  applicant jsonb not null default '{}',
  linked_societe_id uuid references public.societes(id),
  branch_data jsonb not null default '{}',
  documents jsonb not null default '[]',
  medical_appointment jsonb not null default '{}',
  biometric_appointment jsonb not null default '{}',
  emirates_id_address jsonb not null default '{}',
  status text not null default 'brouillon',
  tracking_reference text,
  payment_estimate jsonb not null default '{}'
);

alter table public.visa_application enable row level security;

-- ---------------------------------------------------------------------------
-- DEMO POLICIES ONLY — these allow the public "anon" key to fully read and
-- write this table with no restrictions, which is fine for a quick demo or
-- personal project but is NOT safe for a real production app with multiple
-- users. Before shipping this for real, replace these policies with ones
-- scoped to an authenticated user, e.g. by adding a `user_id uuid references
-- auth.users(id)` column and writing policies like
-- `using (auth.uid() = user_id)` / `with check (auth.uid() = user_id)`.
-- ---------------------------------------------------------------------------

create policy "Demo: anyone can read visa applications"
  on public.visa_application for select
  to anon, authenticated
  using (true);

create policy "Demo: anyone can insert visa applications"
  on public.visa_application for insert
  to anon, authenticated
  with check (true);

create policy "Demo: anyone can update visa applications"
  on public.visa_application for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Demo: anyone can delete visa applications"
  on public.visa_application for delete
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Supabase Storage bucket for uploaded visa documents (PDF / PNG / JPG). See
-- supabase/storage-setup.sql for the bucket creation and its own set of
-- (also permissive, demo-only) policies.
-- ---------------------------------------------------------------------------
