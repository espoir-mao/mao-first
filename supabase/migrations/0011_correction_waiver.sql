-- 0011 — Non-blocking requests (waiver).
-- A pending request blocks the next step of the file (or the grant of a visa)
-- unless MAO waives it: the request then stays visible and can still be
-- answered/closed, but it no longer blocks, and an explanation is mandatory.
-- Idempotent. company_correction_guard, company_review_gate and
-- visa_review_gate are replaced.

alter table public.company_correction_request
  add column if not exists is_blocking boolean not null default true,
  add column if not exists waiver_reason text,
  add column if not exists waived_at timestamptz;

alter table public.company_correction_request
  drop constraint if exists company_correction_waiver_check;
alter table public.company_correction_request
  add constraint company_correction_waiver_check check (
    is_blocking
    or (char_length(btrim(coalesce(waiver_reason, ''))) >= 10 and waived_at is not null)
  );

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
    if not new.is_blocking and new.waived_at is null then
      new.waived_at := now();
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
  if new.is_blocking is distinct from old.is_blocking then
    if new.is_blocking then
      raise exception 'correction: a waived request cannot block again' using errcode = '23514';
    end if;
    if old.status = 'CLOTURE' then
      raise exception 'correction: a closed request cannot be waived' using errcode = '23514';
    end if;
    new.waived_at := coalesce(new.waived_at, now());
  elsif new.waiver_reason is distinct from old.waiver_reason then
    raise exception 'correction: the waiver explanation cannot be edited' using errcode = '23514';
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
     where company_id = new.id and visa_application_id is null
       and status <> 'CLOTURE' and is_blocking;
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

create or replace function public.visa_review_gate()
returns trigger language plpgsql as $$
begin
  if new.decision_status = 'obtenu' and new.decision_status is distinct from old.decision_status
     and exists (select 1 from public.company_correction_request
                  where visa_application_id = new.id and status <> 'CLOTURE' and is_blocking) then
    raise exception 'visa_review: a correction request is still pending on this application'
      using errcode = '23514';
  end if;
  return new;
end $$;
