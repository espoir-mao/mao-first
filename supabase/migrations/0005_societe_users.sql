-- Migration: société users and their section rights
--
-- The new "Administration > Utilisateurs" page lets a société's manager add
-- and remove users and give each one read and/or write rights on the
-- sections société, visa, support, comptabilite and admin (see
-- app/actions/societe-users.ts). `permissions` stores, per section,
-- {"read": bool, "write": bool}.
--
-- Run this against a database that already has supabase/schema.sql and the
-- earlier migrations (0001 to 0004) applied. Safe to re-run: the table is
-- created `if not exists` and the policies are dropped before being
-- re-created.
-- ---------------------------------------------------------------------------

create table if not exists public.societe_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  societe_id uuid not null references public.societes(id) on delete cascade,
  name text not null,
  email text not null,
  permissions jsonb not null default '{}'::jsonb,
  unique (societe_id, email)
);

create index if not exists societe_users_societe_id_idx
  on public.societe_users (societe_id);

alter table public.societe_users enable row level security;

-- DEMO POLICIES ONLY — same caveat as the other tables (no per-user
-- scoping, the anon key can read/write everything).

drop policy if exists "Demo: anyone can read societe_users" on public.societe_users;
create policy "Demo: anyone can read societe_users"
  on public.societe_users for select
  to anon, authenticated
  using (true);

drop policy if exists "Demo: anyone can insert societe_users" on public.societe_users;
create policy "Demo: anyone can insert societe_users"
  on public.societe_users for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Demo: anyone can update societe_users" on public.societe_users;
create policy "Demo: anyone can update societe_users"
  on public.societe_users for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Demo: anyone can delete societe_users" on public.societe_users;
create policy "Demo: anyone can delete societe_users"
  on public.societe_users for delete
  to anon, authenticated
  using (true);
