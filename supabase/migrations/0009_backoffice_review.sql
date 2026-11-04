-- Migration: Backoffice dossier review.
--
-- 1. KYC of the shareholders moves from the client's creation flow to the MAO
--    review: a file can now be SUBMITTED without KYC (company_guard replaced
--    below), KYC can only start once the file left DRAFT, and the name cannot
--    be approved while a shareholder / the manager is not VERIFIED.
-- 2. company_correction_request: the MAO team raises an inconsistency or an
--    additional request (on a company file, or on one of its visa
--    applications); the company answers (text + attachments); MAO closes it.
--    A file cannot move forward while one of its corrections is still open
--    or waiting for MAO to close it.
--
-- Run after 0006 / 0007 / 0008. Safe to re-run.
-- ---------------------------------------------------------------------------

-- 1a. company_guard without the KYC condition at submission ------------------
create or replace function public.company_guard()
returns trigger language plpgsql as $$
declare
  opt public.authority_office_option;
  ot public.office_type;
  lf public.legal_form;
  v_present integer;
  v_total numeric;
  v_names integer;
  v_pay_status text;
  v_missing integer;
  v_managers integer;
  v_licence uuid;
begin
  -- visa quota <= quota allowed by the office
  if new.office_type_id is not null and new.visa_quota is not null then
    select * into opt from public.authority_office_option
     where authority_id = new.authority_id and office_type_id = new.office_type_id;
    if found and new.visa_quota > opt.visa_quota_max then
      raise exception 'company: visa_quota % exceeds the % allowed by this office option',
        new.visa_quota, opt.visa_quota_max using errcode = '23514';
    end if;
  end if;

  -- mainland company => an office providing Ejari
  if new.office_type_id is not null and new.jurisdiction_type = 'MAINLAND' and not new.is_legacy then
    select * into ot from public.office_type where id = new.office_type_id;
    if not ot.provides_ejari then
      raise exception 'company: a MAINLAND company needs an office with Ejari (got %)', ot.code
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- the structure is frozen once the file left DRAFT
    if old.status <> 'DRAFT' and not new.is_legacy and (
         new.jurisdiction_type is distinct from old.jurisdiction_type
      or new.authority_id is distinct from old.authority_id
      or new.legal_form_id is distinct from old.legal_form_id
      or new.client_choice is distinct from old.client_choice
      or new.licence_type_id is distinct from old.licence_type_id
      or new.office_type_id is distinct from old.office_type_id
      or new.visa_quota is distinct from old.visa_quota
    ) then
      raise exception 'company: the structure cannot change after submission'
        using errcode = '23514';
    end if;

    -- changing the authority of a DRAFT invalidates its activities
    if old.status = 'DRAFT' and new.authority_id is distinct from old.authority_id
       and exists (select 1 from public.company_activity where company_id = new.id) then
      raise exception 'company: remove the activities before changing the authority'
        using errcode = '23514';
    end if;
    if old.status = 'DRAFT' and new.licence_type_id is distinct from old.licence_type_id
       and exists (select 1 from public.company_activity where company_id = new.id) then
      raise exception 'company: remove the activities before changing the licence type'
        using errcode = '23514';
    end if;

    if new.status is distinct from old.status and not new.is_legacy then
      -- status machine
      if not (
           (old.status = 'DRAFT' and new.status = 'SUBMITTED')
        or (old.status = 'SUBMITTED' and new.status in ('IN_REVIEW', 'REJECTED'))
        or (old.status = 'IN_REVIEW' and new.status in ('NAME_APPROVED', 'NAME_REJECTED', 'REJECTED'))
        or (old.status = 'NAME_REJECTED' and new.status in ('IN_REVIEW', 'REJECTED'))
        or (old.status = 'NAME_APPROVED' and new.status in ('INITIAL_APPROVAL', 'REJECTED'))
        or (old.status = 'INITIAL_APPROVAL' and new.status in ('LICENCE_ISSUED', 'REJECTED'))
      ) then
        raise exception 'company: transition % -> % is not allowed', old.status, new.status
          using errcode = '23514';
      end if;

      -- name rules
      if new.status = 'NAME_APPROVED' then
        if not exists (
          select 1 from public.company_name_request r
           where r.company_id = new.id and r.status = 'APPROVED'
             and lower(btrim(r.proposed_name)) = lower(btrim(coalesce(new.trade_name, '')))
        ) then
          raise exception 'company: NAME_APPROVED needs an APPROVED name request matching trade_name'
            using errcode = '23514';
        end if;
      end if;
      if new.status = 'NAME_REJECTED' then
        if exists (select 1 from public.company_name_request
                    where company_id = new.id and status in ('PENDING', 'APPROVED')) then
          raise exception 'company: NAME_REJECTED needs every proposed name to be rejected'
            using errcode = '23514';
        end if;
      end if;

      -- a complete file to leave DRAFT
      if old.status = 'DRAFT' then
        select count(*) into v_names from public.company_name_request
         where company_id = new.id and rank in (1, 2, 3);
        if v_names < 3 then
          raise exception 'company_submission: 3 name proposals (ranks 1 to 3) are required'
            using errcode = '23514';
        end if;

        if not exists (select 1 from public.company_activity where company_id = new.id) then
          raise exception 'company_submission: at least one activity is required'
            using errcode = '23514';
        end if;

        select licence_type_id into v_licence from (
          select a.licence_type_id from public.company_activity ca
            join public.activity a on a.id = ca.activity_id
           where ca.company_id = new.id
        ) x group by licence_type_id limit 1;

        select * into lf from public.legal_form where id = new.legal_form_id;
        select count(*), coalesce(sum(share_pct), 0) into v_present, v_total
          from public.shareholder where company_id = new.id and share_pct > 0;
        if v_total <> 100 then
          raise exception 'company_submission: shares must add up to 100%% (got %)', v_total
            using errcode = '23514';
        end if;
        if v_present < lf.min_shareholders
           or (lf.max_shareholders is not null and v_present > lf.max_shareholders) then
          raise exception 'company_submission: % shareholder(s) given, % needs % to %',
            v_present, lf.code, lf.min_shareholders, coalesce(lf.max_shareholders::text, 'n')
            using errcode = '23514';
        end if;
        if new.client_choice = 'MULTI' and v_present < 2 then
          raise exception 'company_submission: several shareholders are required'
            using errcode = '23514';
        end if;
        if new.client_choice in ('SOLO', 'FREELANCE') and v_present <> 1 then
          raise exception 'company_submission: exactly one shareholder is required'
            using errcode = '23514';
        end if;

        select count(*) into v_managers from public.shareholder
         where company_id = new.id and is_manager;
        if v_managers <> 1 then
          raise exception 'company_submission: exactly one manager is required (got %)', v_managers
            using errcode = '23514';
        end if;

        select count(*) into v_missing from public.company_document_checklist(new.id) where not provided;
        if v_missing > 0 then
          raise exception 'company_submission: % required document(s) missing', v_missing
            using errcode = '23514';
        end if;

        select status into v_pay_status from public.company_payment where company_id = new.id;
        if v_pay_status is distinct from 'PAID' then
          raise exception 'company_submission: the payment must be PAID' using errcode = '23514';
        end if;
      end if;
    end if;
  end if;

  return new;
end $$;

-- 1b. KYC belongs to the review ------------------------------------------------
create or replace function public.shareholder_kyc_guard()
returns trigger language plpgsql as $$
declare
  c public.company;
begin
  if new.kyc_status is distinct from old.kyc_status
     and new.kyc_status in ('PENDING', 'VERIFIED', 'REJECTED') then
    select * into c from public.company where id = new.company_id;
    if c.status = 'DRAFT' and not c.is_legacy then
      raise exception 'shareholder: KYC is run by MAO once the file is submitted'
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists shareholder_kyc_guard on public.shareholder;
create trigger shareholder_kyc_guard
  before update of kyc_status on public.shareholder
  for each row execute function public.shareholder_kyc_guard();

-- the shareholder_guard freezes shareholders after submission; KYC updates are
-- the one thing MAO still writes, so let those through.
create or replace function public.shareholder_guard()
returns trigger language plpgsql as $$
declare
  v_company uuid := coalesce(new.company_id, old.company_id);
  v_status text;
  v_legacy boolean;
  v_total numeric;
begin
  select status, is_legacy into v_status, v_legacy from public.company where id = v_company;
  if v_status is not null and v_status <> 'DRAFT' and not v_legacy then
    if tg_op = 'UPDATE'
       and (new.company_id, new.person_id, new.parent_company_id, new.share_pct, new.is_manager)
           is not distinct from
           (old.company_id, old.person_id, old.parent_company_id, old.share_pct, old.is_manager) then
      return new; -- only KYC columns changed
    end if;
    raise exception 'shareholder: shareholders are frozen after submission' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  select coalesce(sum(share_pct), 0) into v_total from public.shareholder
   where company_id = new.company_id and id is distinct from new.id;
  if v_total + new.share_pct > 100 then
    raise exception 'shareholder: shares would exceed 100%% (%)', v_total + new.share_pct
      using errcode = '23514';
  end if;
  return new;
end $$;

-- 2. correction requests -------------------------------------------------------
create table if not exists public.company_correction_request (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reference text not null,
  company_id uuid not null references public.company(id) on delete cascade,
  visa_application_id uuid references public.visa_application(id) on delete cascade,
  section text not null check (section in (
    'STRUCTURE', 'ACTIVITIES', 'NAMES', 'OFFICE', 'HOLDERS', 'DOCUMENTS', 'OTHER',
    'VISA_APPLICANT', 'VISA_DOCUMENTS', 'VISA_OTHER'
  )),
  message text not null check (char_length(btrim(message)) >= 5),
  status text not null default 'OUVERT' check (status in ('OUVERT', 'REPONDU', 'CLOTURE')),
  response text,
  response_files jsonb not null default '[]'::jsonb check (jsonb_typeof(response_files) = 'array'),
  answered_at timestamptz,
  closed_at timestamptz,
  -- a visa correction targets a visa section, a company correction a company one
  check ((visa_application_id is not null) = (section like 'VISA\_%')),
  check (status <> 'OUVERT' or (answered_at is null and closed_at is null)),
  check (status <> 'REPONDU' or (answered_at is not null and closed_at is null
         and (char_length(btrim(coalesce(response, ''))) >= 2 or jsonb_array_length(response_files) > 0))),
  check (status <> 'CLOTURE' or closed_at is not null)
);

create index if not exists company_correction_request_company_idx
  on public.company_correction_request (company_id, created_at desc);
create index if not exists company_correction_request_visa_idx
  on public.company_correction_request (visa_application_id) where visa_application_id is not null;

create or replace function public.company_correction_guard()
returns trigger language plpgsql as $$
declare
  v_visa_company uuid;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'OUVERT' then
      raise exception 'correction: a new request starts OUVERT' using errcode = '23514';
    end if;
    if new.visa_application_id is not null then
      select company_id into v_visa_company from public.visa_application
       where id = new.visa_application_id;
      if v_visa_company is distinct from new.company_id then
        raise exception 'correction: the visa application does not belong to this company'
          using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.company_id is distinct from old.company_id
     or new.visa_application_id is distinct from old.visa_application_id
     or new.section is distinct from old.section
     or new.message is distinct from old.message
     or new.reference is distinct from old.reference then
    raise exception 'correction: the request itself cannot be edited' using errcode = '23514';
  end if;
  if new.status is distinct from old.status then
    if not (
         (old.status = 'OUVERT' and new.status in ('REPONDU', 'CLOTURE'))
      or (old.status = 'REPONDU' and new.status = 'CLOTURE')
    ) then
      raise exception 'correction: transition % -> % is not allowed', old.status, new.status
        using errcode = '23514';
    end if;
  elsif old.status = 'CLOTURE' then
    raise exception 'correction: a closed request cannot change' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists company_correction_guard on public.company_correction_request;
create trigger company_correction_guard
  before insert or update on public.company_correction_request
  for each row execute function public.company_correction_guard();

-- A file cannot move forward while corrections are pending (to answer, or to
-- close by MAO). Moving to IN_REVIEW is MAO's own step and is never blocked.
-- Name approval also needs every natural-person shareholder / manager VERIFIED.
create or replace function public.company_review_gate()
returns trigger language plpgsql as $$
declare
  v_open integer;
  v_unverified integer;
begin
  if new.is_legacy or new.status is not distinct from old.status then
    return new;
  end if;
  if new.status in ('SUBMITTED', 'NAME_APPROVED', 'INITIAL_APPROVAL', 'LICENCE_ISSUED') then
    select count(*) into v_open from public.company_correction_request
     where company_id = new.id and visa_application_id is null and status <> 'CLOTURE';
    if v_open > 0 then
      raise exception 'company_review: % correction request(s) still pending', v_open
        using errcode = '23514';
    end if;
  end if;
  if new.status = 'NAME_APPROVED' then
    select count(*) into v_unverified from public.shareholder
     where company_id = new.id and person_id is not null
       and (share_pct > 0 or is_manager) and kyc_status <> 'VERIFIED';
    if v_unverified > 0 then
      raise exception 'company_review: KYC must be VERIFIED for every shareholder and the manager before the name is approved'
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists company_review_gate on public.company;
create trigger company_review_gate
  before update of status on public.company
  for each row execute function public.company_review_gate();

alter table public.company_correction_request enable row level security;

drop policy if exists "Demo: anyone can read company_correction_request" on public.company_correction_request;
create policy "Demo: anyone can read company_correction_request"
  on public.company_correction_request for select to anon, authenticated using (true);
drop policy if exists "Demo: anyone can insert company_correction_request" on public.company_correction_request;
create policy "Demo: anyone can insert company_correction_request"
  on public.company_correction_request for insert to anon, authenticated with check (true);
drop policy if exists "Demo: anyone can update company_correction_request" on public.company_correction_request;
create policy "Demo: anyone can update company_correction_request"
  on public.company_correction_request for update to anon, authenticated using (true) with check (true);

-- A visa cannot be granted while a correction on it is still pending.
create or replace function public.visa_review_gate()
returns trigger language plpgsql as $$
begin
  if new.decision_status = 'obtenu' and new.decision_status is distinct from old.decision_status
     and exists (select 1 from public.company_correction_request
                  where visa_application_id = new.id and status <> 'CLOTURE') then
    raise exception 'visa_review: a correction request is still pending on this application'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists visa_review_gate on public.visa_application;
create trigger visa_review_gate
  before update of decision_status on public.visa_application
  for each row execute function public.visa_review_gate();
