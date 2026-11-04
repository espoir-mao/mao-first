-- Migration: Ejari lease choice (mainland) and optional documents.
--
-- * company.lease_mode (mainland only): 'OWN' = the company provides its own
--   Ejari lease (a lease document is then required, and no office price is
--   charged), 'MAO' = it lets MAO take care of the lease (the office price of
--   the authority applies). A mainland file cannot be submitted without it.
-- * required_document.is_optional: an optional document never blocks the
--   submission (the manager's residence visa / Emirates ID).
-- * required_document.required_when = 'LEASE_OWN': only expected when the
--   company provides its own lease.
-- company_document_checklist, company_quote and company_guard are replaced.
-- Run after 0006 to 0009. Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.company add column if not exists lease_mode text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'company_lease_mode_check'
                  and conrelid = 'public.company'::regclass) then
    alter table public.company add constraint company_lease_mode_check
      check (lease_mode is null or (lease_mode in ('OWN', 'MAO') and jurisdiction_type = 'MAINLAND'));
  end if;
end $$;

alter table public.required_document
  add column if not exists is_optional boolean not null default false,
  add column if not exists required_when text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'required_document_required_when_check'
                  and conrelid = 'public.required_document'::regclass) then
    alter table public.required_document add constraint required_document_required_when_check
      check (required_when is null or required_when = 'LEASE_OWN');
  end if;
end $$;

-- reference data: the lease document (mainland authorities) and the optional visa
insert into public.required_document (authority_id, code, label, applies_to, required_when)
select a.id, 'EJARI_LEASE', 'Contrat de bail enregistré Ejari', 'COMPANY', 'LEASE_OWN'
  from public.authority a
 where a.jurisdiction_type = 'MAINLAND' and a.is_available
on conflict do nothing;

update public.required_document
   set is_optional = true,
       label = 'Visa de résidence / Emirates ID du dirigeant (facultatif)'
 where code = 'MANAGER_RESIDENCE';

-- checklist: now flags optional documents and honours required_when
drop function if exists public.company_document_checklist(uuid);
create function public.company_document_checklist(p_company uuid)
returns table (
  required_document_id uuid,
  code text,
  label text,
  applies_to text,
  shareholder_id uuid,
  provided boolean,
  optional boolean
)
language sql stable as $$
  with c as (select * from public.company where id = p_company),
  rd as (
    select r.*
      from public.required_document r, c
     where r.authority_id = c.authority_id
       and (r.legal_form_id is null or r.legal_form_id = c.legal_form_id)
       and (r.required_when is null or (r.required_when = 'LEASE_OWN' and c.lease_mode = 'OWN'))
       and (
         r.activity_id is null
         or exists (
           select 1 from public.company_activity ca
            where ca.company_id = c.id and ca.activity_id = r.activity_id
         )
       )
  ),
  expected as (
    select rd.id as rdid, rd.code, rd.label, rd.applies_to, null::uuid as sid, rd.is_optional
      from rd where rd.applies_to = 'COMPANY'
    union all
    select rd.id, rd.code, rd.label, rd.applies_to, s.id, rd.is_optional
      from rd join public.shareholder s on s.company_id = p_company
     where rd.applies_to = 'SHAREHOLDER' and s.person_id is not null
    union all
    select rd.id, rd.code, rd.label, rd.applies_to, s.id, rd.is_optional
      from rd join public.shareholder s on s.company_id = p_company
     where rd.applies_to = 'MANAGER' and s.is_manager
    union all
    select rd.id, rd.code, rd.label, rd.applies_to, s.id, rd.is_optional
      from rd join public.shareholder s on s.company_id = p_company
     where rd.applies_to = 'PARENT_COMPANY' and s.parent_company_id is not null
  )
  select e.rdid, e.code, e.label, e.applies_to, e.sid,
         exists (
           select 1 from public.company_document d
            where d.company_id = p_company
              and d.required_document_id = e.rdid
              and d.shareholder_id is not distinct from e.sid
              and d.status in ('UPLOADED', 'VALIDATED')
         ),
         e.is_optional
    from expected e
$$;

-- quote: no office price when the company provides its own lease
create or replace function public.company_quote(p_company uuid)
returns table (package_price_aed numeric, office_price_aed numeric, mao_fee_aed numeric, total_aed numeric)
language plpgsql stable as $$
declare
  c public.company;
  v_package numeric;
  v_office numeric;
  v_fee numeric;
begin
  select * into c from public.company where id = p_company;
  if not found then
    raise exception 'company_quote: company % not found', p_company using errcode = 'P0002';
  end if;
  if c.authority_id is null or c.legal_form_id is null or c.office_type_id is null or c.visa_quota is null then
    raise exception 'company_quote: the company is not configured enough to be priced'
      using errcode = '23514';
  end if;

  select ap.price_aed into v_package
    from public.authority_pricing ap
   where ap.authority_id = c.authority_id
     and ap.legal_form_id = c.legal_form_id
     and ap.visa_count = c.visa_quota
     and ap.valid_from <= current_date
     and (ap.valid_to is null or ap.valid_to >= current_date)
   order by ap.valid_from desc
   limit 1;
  if v_package is null then
    raise exception 'company_quote: no valid package price for this authority / legal form / visa count'
      using errcode = '23514';
  end if;

  if c.lease_mode = 'OWN' then
    v_office := 0;
  else
    select o.annual_price_aed into v_office
      from public.authority_office_option o
     where o.authority_id = c.authority_id and o.office_type_id = c.office_type_id;
  end if;

  select f.fee_aed into v_fee
    from public.mao_fee f
   where f.jurisdiction_type = c.jurisdiction_type
     and f.valid_from <= current_date
     and (f.valid_to is null or f.valid_to >= current_date)
   order by f.valid_from desc
   limit 1;

  return query select v_package, coalesce(v_office, 0), coalesce(v_fee, 0),
                      v_package + coalesce(v_office, 0) + coalesce(v_fee, 0);
end $$;

-- company_guard: optional documents do not block, mainland needs a lease choice
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
      or new.lease_mode is distinct from old.lease_mode
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

        if new.jurisdiction_type = 'MAINLAND' and new.lease_mode is null then
          raise exception 'company_submission: a mainland company must say who provides the Ejari lease'
            using errcode = '23514';
        end if;

        select count(*) into v_missing from public.company_document_checklist(new.id)
         where not provided and not optional;
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
