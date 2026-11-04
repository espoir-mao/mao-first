-- Migration: support ticket follow-ups + requester approval
--
-- A société can now, from its dashboard, follow up on an open support ticket
-- ("relancer") and approve or refuse the processing once the admin marked it
-- as treated (a refusal, with a reason, reopens the ticket). This adds the
-- columns that store that exchange (see followUpSupportTicket /
-- reviewSupportTicket in app/actions/support.ts).
--
-- Run this against a database that already has supabase/schema.sql and the
-- earlier migrations (0001 to 0003) applied. Safe to re-run: every statement
-- is guarded (`add column if not exists`, constraint added only if missing).
-- ---------------------------------------------------------------------------

alter table public.support_tickets
  add column if not exists follow_up_count integer not null default 0,
  add column if not exists last_follow_up_at timestamptz,
  add column if not exists approval text,
  add column if not exists approval_comment text,
  add column if not exists approval_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_tickets_approval_check'
      and conrelid = 'public.support_tickets'::regclass
  ) then
    alter table public.support_tickets
      add constraint support_tickets_approval_check
      check (approval is null or approval in ('approuve', 'refuse'));
  end if;
end $$;
