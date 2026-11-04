-- Migration: profile change requests ("tickets") reviewed in Backoffice MAO.
--
-- A signed-in person cannot edit their identity directly any more: from
-- /profil they submit a request (first/last name, e-mail, status = manager or
-- shareholder). It lands here, and the MAO team approves or refuses it in
-- Backoffice MAO > Demandes de profil. The app displays the latest APPROVED
-- values over the Supabase Auth metadata (login credentials are not touched).
--
-- Rules enforced in the database (not only in the UI):
--   * at least one field is requested, holder_status is MANAGER or SHAREHOLDER,
--     e-mail has a plausible shape, names are not blank;
--   * a single open request per person at a time;
--   * a decision needs decided_at, and a refusal needs a comment;
--   * a decided request can no longer change status or content.
-- Safe to re-run.
-- ---------------------------------------------------------------------------

create table if not exists public.profile_change_request (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reference text not null,
  user_id uuid not null,
  user_email text,
  company_id uuid references public.company(id) on delete set null,
  company_name text,
  current_values jsonb not null default '{}'::jsonb,
  requested_values jsonb not null,
  reason text,
  status text not null default 'ouvert' check (status in ('ouvert', 'approuve', 'refuse')),
  decided_at timestamptz,
  decision_comment text,
  check (jsonb_typeof(requested_values) = 'object'),
  check (requested_values ?| array['first_name', 'last_name', 'email', 'holder_status']),
  check (requested_values - 'first_name' - 'last_name' - 'email' - 'holder_status' = '{}'::jsonb),
  check (not (requested_values ? 'first_name') or char_length(btrim(requested_values ->> 'first_name')) between 1 and 80),
  check (not (requested_values ? 'last_name') or char_length(btrim(requested_values ->> 'last_name')) between 1 and 80),
  check (not (requested_values ? 'email') or (requested_values ->> 'email') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  check (not (requested_values ? 'holder_status') or (requested_values ->> 'holder_status') in ('MANAGER', 'SHAREHOLDER')),
  check ((status = 'ouvert') = (decided_at is null)),
  check (status <> 'refuse' or char_length(btrim(coalesce(decision_comment, ''))) >= 3)
);

create unique index if not exists profile_change_request_one_open_per_user
  on public.profile_change_request (user_id) where status = 'ouvert';
create index if not exists profile_change_request_user_idx
  on public.profile_change_request (user_id, created_at desc);

create or replace function public.profile_change_request_guard()
returns trigger language plpgsql as $$
begin
  if old.status <> 'ouvert' then
    raise exception 'profile_change_request % is already decided', old.id
      using errcode = 'check_violation';
  end if;
  if new.requested_values is distinct from old.requested_values
     or new.user_id is distinct from old.user_id then
    raise exception 'profile_change_request: the request content cannot be changed'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists profile_change_request_guard on public.profile_change_request;
create trigger profile_change_request_guard
  before update on public.profile_change_request
  for each row execute function public.profile_change_request_guard();

alter table public.profile_change_request enable row level security;

drop policy if exists "Demo: anyone can read profile_change_request" on public.profile_change_request;
create policy "Demo: anyone can read profile_change_request"
  on public.profile_change_request for select to anon, authenticated using (true);
drop policy if exists "Demo: anyone can insert profile_change_request" on public.profile_change_request;
create policy "Demo: anyone can insert profile_change_request"
  on public.profile_change_request for insert to anon, authenticated with check (true);
drop policy if exists "Demo: anyone can update profile_change_request" on public.profile_change_request;
create policy "Demo: anyone can update profile_change_request"
  on public.profile_change_request for update to anon, authenticated using (true) with check (true);
