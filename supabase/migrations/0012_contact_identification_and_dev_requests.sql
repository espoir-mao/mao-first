-- 0012 — "Nous contacter" identification + requests to the development team.
-- 1. support_tickets: a contact message can come from a visitor without account,
--    so it now carries the person's phone and whether they were signed in.
-- 2. dev_request: requests made by the MAO team to the developers (changes or
--    new features), tracked until delivered or declined.
-- Idempotent.

alter table public.support_tickets
  add column if not exists requester_phone text,
  add column if not exists is_visitor boolean not null default false;

create table if not exists public.dev_request (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reference text not null unique,
  kind text not null check (kind in ('FEATURE', 'CHANGE', 'BUG')),
  title text not null check (char_length(btrim(title)) >= 3),
  description text not null check (char_length(btrim(description)) >= 10),
  priority text not null default 'NORMAL' check (priority in ('LOW', 'NORMAL', 'HIGH')),
  status text not null default 'NEW' check (status in ('NEW', 'IN_PROGRESS', 'DONE', 'DECLINED')),
  requester_name text,
  requester_email text,
  dev_comment text,
  -- a declined request always says why
  check (status <> 'DECLINED' or char_length(btrim(coalesce(dev_comment, ''))) >= 3)
);

create index if not exists dev_request_status_idx on public.dev_request (status, created_at desc);

alter table public.dev_request enable row level security;

-- DEMO POLICIES ONLY (same caveat as the other tables): scope them to the MAO
-- backoffice profile before any real use.
drop policy if exists "Demo: anyone can read dev_request" on public.dev_request;
create policy "Demo: anyone can read dev_request"
  on public.dev_request for select to anon, authenticated using (true);
drop policy if exists "Demo: anyone can insert dev_request" on public.dev_request;
create policy "Demo: anyone can insert dev_request"
  on public.dev_request for insert to anon, authenticated with check (true);
drop policy if exists "Demo: anyone can update dev_request" on public.dev_request;
create policy "Demo: anyone can update dev_request"
  on public.dev_request for update to anon, authenticated using (true) with check (true);
