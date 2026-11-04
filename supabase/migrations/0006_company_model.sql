-- Migration: company creation data model (authority / legal form / activities /
-- office / pricing / documents) and the `company` aggregate that replaces the
-- legacy `societes` table (see 0007_migrate_societes_to_company.sql).
--
-- Flow it backs (one screen per step): 1 jurisdiction (MAINLAND | FREE_ZONE),
-- 2 authority (the "guichet"), 3 structure (SOLO | MULTI | FREELANCE ->
-- legal_form), 4 activities (-> licence_type), 5 trade name (3 proposals),
-- 6 office + visa quota, 7 shareholders & manager (KYC), 8 documents,
-- 9 payment, 10 submission & follow-up.
--
-- The business rules are enforced HERE (FK / CHECK / triggers), not only in
-- the front-end:
--   * (authority_id, legal_form_id) must exist in authority_legal_form;
--   * company.legal_form is the one resolved from (authority, client_choice);
--   * every company_activity.activity belongs to the company's authority, has
--     the company's licence_type and does not require an external approval;
--   * visa_quota <= authority_office_option.visa_quota_max;
--   * a MAINLAND company needs an office type that provides Ejari;
--   * status machine DRAFT > SUBMITTED > IN_REVIEW > NAME_APPROVED >
--     INITIAL_APPROVAL > LICENCE_ISSUED (+ NAME_REJECTED / REJECTED), and a
--     complete file (3 names, activities, 100% of shares, one manager, KYC,
--     documents, payment) before leaving DRAFT;
--   * a visa application is only created for a company with an issued licence
--     and within its visa_quota.
--
-- Reference data (authorities, prices, activities...) is NOT in this file: it
-- lives in supabase/seed/demo_reference_data.sql (demo values).
--
-- Safe to re-run: tables use `if not exists`, functions are replaced, triggers
-- and policies are dropped before being re-created.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";
create extension if not exists btree_gist;

-- ============================================================ reference data

create table if not exists public.jurisdiction_type (
  code text primary key check (code in ('MAINLAND', 'FREE_ZONE')),
  label text not null,
  description text not null default ''
);

-- The two jurisdictions are structural (CHECK, composite FKs and the legacy
-- migration rely on them); labels and descriptions can be edited freely.
insert into public.jurisdiction_type (code, label, description) values
  ('MAINLAND', 'Mainland', 'Société onshore enregistrée auprès du Department of Economy de l''émirat.'),
  ('FREE_ZONE', 'Zone franche', 'Société enregistrée auprès de l''autorité d''une zone franche.')
on conflict (code) do nothing;

create table if not exists public.authority (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  jurisdiction_type text not null references public.jurisdiction_type(code),
  name text not null,
  emirate text not null,
  tier text not null default 'SECONDARY' check (tier in ('CORE', 'SECONDARY')),
  is_available boolean not null default false,
  allows_freelance boolean not null default false,
  website text,
  unique (id, jurisdiction_type)
);

create table if not exists public.legal_form (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  jurisdiction_type text not null references public.jurisdiction_type(code),
  label text not null,
  description text not null default '',
  min_shareholders integer not null default 1 check (min_shareholders >= 1),
  max_shareholders integer,
  in_mao_flow boolean not null default false,
  check (max_shareholders is null or max_shareholders >= min_shareholders),
  unique (id, jurisdiction_type)
);

create table if not exists public.authority_legal_form (
  authority_id uuid not null references public.authority(id) on delete cascade,
  legal_form_id uuid not null references public.legal_form(id),
  client_choice text not null check (client_choice in ('SOLO', 'MULTI', 'FREELANCE')),
  primary key (authority_id, client_choice),
  unique (authority_id, legal_form_id),
  unique (authority_id, client_choice, legal_form_id)
);

create table if not exists public.licence_type (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text not null default ''
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  authority_id uuid not null references public.authority(id) on delete cascade,
  code text not null,
  label text not null,
  licence_type_id uuid not null references public.licence_type(id),
  requires_external_approval boolean not null default false,
  unique (authority_id, code),
  unique (id, authority_id)
);

create table if not exists public.office_type (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text not null default '',
  -- Ejari = official registration of a lease in Dubai; mandatory for a
  -- MAINLAND company.
  provides_ejari boolean not null default false
);

create table if not exists public.authority_office_option (
  authority_id uuid not null references public.authority(id) on delete cascade,
  office_type_id uuid not null references public.office_type(id),
  visa_quota_max integer not null check (visa_quota_max >= 0),
  annual_price_aed numeric(12, 2) not null check (annual_price_aed >= 0),
  primary key (authority_id, office_type_id)
);

create table if not exists public.authority_pricing (
  id uuid primary key default gen_random_uuid(),
  authority_id uuid not null,
  legal_form_id uuid not null,
  visa_count integer not null check (visa_count >= 0),
  price_aed numeric(12, 2) not null check (price_aed >= 0),
  valid_from date not null default current_date,
  valid_to date,
  check (valid_to is null or valid_to >= valid_from),
  foreign key (authority_id, legal_form_id)
    references public.authority_legal_form(authority_id, legal_form_id),
  -- no two overlapping price periods for the same package
  exclude using gist (
    authority_id with =,
    legal_form_id with =,
    visa_count with =,
    daterange(valid_from, valid_to, '[]') with &&
  )
);

create table if not exists public.required_document (
  id uuid primary key default gen_random_uuid(),
  authority_id uuid not null references public.authority(id) on delete cascade,
  legal_form_id uuid,
  -- optional: only required when this activity is part of the licence (CV,
  -- diploma...)
  activity_id uuid,
  code text not null,
  label text not null,
  applies_to text not null
    check (applies_to in ('COMPANY', 'SHAREHOLDER', 'MANAGER', 'PARENT_COMPANY')),
  foreign key (authority_id, legal_form_id)
    references public.authority_legal_form(authority_id, legal_form_id),
  foreign key (activity_id, authority_id)
    references public.activity(id, authority_id)
);

create unique index if not exists required_document_unique_idx
  on public.required_document (
    authority_id,
    code,
    coalesce(legal_form_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- MAO service fee added to the authority package (demo values in the seed).
create table if not exists public.mao_fee (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_type text not null references public.jurisdiction_type(code),
  fee_aed numeric(12, 2) not null check (fee_aed >= 0),
  valid_from date not null default current_date,
  valid_to date,
  check (valid_to is null or valid_to >= valid_from)
);

-- ===================================================== people & parent company

create table if not exists public.person (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  nationality text,
  passport_number text,
  birth_date date
);

create table if not exists public.parent_company (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  country text,
  registration_number text
);

-- ================================================================== company

create table if not exists public.company (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Supabase auth user that created the file (null when created logged out).
  client_id uuid references auth.users(id) on delete set null,
  jurisdiction_type text references public.jurisdiction_type(code),
  authority_id uuid,
  legal_form_id uuid,
  client_choice text check (client_choice in ('SOLO', 'MULTI', 'FREELANCE')),
  licence_type_id uuid references public.licence_type(id),
  office_type_id uuid,
  visa_quota integer check (visa_quota >= 0),
  trade_name text,
  licence_number text,
  licence_issued_at timestamptz,
  licence_expires_at timestamptz,
  status text not null default 'DRAFT' check (
    status in (
      'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NAME_REJECTED', 'NAME_APPROVED',
      'INITIAL_APPROVAL', 'LICENCE_ISSUED', 'REJECTED'
    )
  ),
  -- Extras used by the app:
  accounting boolean not null default false,
  tracking_reference text,
  requester_name text,
  rejection_reason text,
  status_history jsonb not null default '[]',
  licence_history jsonb not null default '[]',
  licence_renewal_tickets jsonb not null default '[]',
  -- Rows carried over from the legacy `societes` table: they keep their
  -- status/licence but may lack the structured data of the new flow.
  is_legacy boolean not null default false,
  -- Free-form data of a legacy row that has no column in the new model
  -- (activity category/description, free zone name, uploaded files...).
  legacy_data jsonb not null default '{}',

  unique (id, authority_id),

  foreign key (authority_id, jurisdiction_type)
    references public.authority(id, jurisdiction_type),
  foreign key (legal_form_id, jurisdiction_type)
    references public.legal_form(id, jurisdiction_type),
  -- the (authority, legal form) pair must exist in authority_legal_form
  foreign key (authority_id, legal_form_id)
    references public.authority_legal_form(authority_id, legal_form_id),
  -- ... and be the one resolved from the client's structure choice
  foreign key (authority_id, client_choice, legal_form_id)
    references public.authority_legal_form(authority_id, client_choice, legal_form_id),
  -- the office must be offered by the authority
  foreign key (authority_id, office_type_id)
    references public.authority_office_option(authority_id, office_type_id),

  -- MATCH SIMPLE composite FKs skip rows with a NULL part: close those gaps.
  check (authority_id is null or jurisdiction_type is not null),
  check (legal_form_id is null or (authority_id is not null and client_choice is not null)),
  check (client_choice is null or authority_id is not null),
  check (office_type_id is null or authority_id is not null),

  check (
    (licence_number is null) = (licence_issued_at is null)
    and (licence_expires_at is null or licence_issued_at is not null)
  ),
  check (licence_expires_at is null or licence_expires_at > licence_issued_at),
  check (
    status <> 'LICENCE_ISSUED'
    or (licence_number is not null and licence_issued_at is not null
        and licence_expires_at is not null)
  ),
  check (status <> 'REJECTED' or rejection_reason is not null),
  -- a file that left DRAFT is complete
  check (
    is_legacy
    or status = 'DRAFT'
    or (
      jurisdiction_type is not null and authority_id is not null
      and legal_form_id is not null and client_choice is not null
      and licence_type_id is not null and office_type_id is not null
      and visa_quota is not null
    )
  ),
  -- once the name is approved the company has its trade name
  check (
    is_legacy
    or status in ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NAME_REJECTED', 'REJECTED')
    or trade_name is not null
  )
);

create index if not exists company_client_id_idx on public.company (client_id);
create index if not exists company_status_idx on public.company (status);

create table if not exists public.company_activity (
  company_id uuid not null references public.company(id) on delete cascade,
  activity_id uuid not null references public.activity(id),
  primary key (company_id, activity_id)
);

create table if not exists public.shareholder (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  person_id uuid references public.person(id),
  parent_company_id uuid references public.parent_company(id),
  share_pct numeric(5, 2) not null check (share_pct >= 0 and share_pct <= 100),
  is_manager boolean not null default false,
  -- KYC is run with Sumsub on every natural person (simulated in this demo).
  kyc_status text not null default 'NOT_STARTED' check (
    kyc_status in ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED', 'NOT_APPLICABLE')
  ),
  kyc_reference text,
  kyc_checked_at timestamptz,
  -- a holder is either a person or a parent company
  check ((person_id is null) <> (parent_company_id is null)),
  -- the manager is a natural person
  check (not is_manager or person_id is not null),
  check (parent_company_id is null or kyc_status = 'NOT_APPLICABLE'),
  unique (id, company_id),
  unique (company_id, person_id),
  unique (company_id, parent_company_id)
);

create unique index if not exists shareholder_one_manager_idx
  on public.shareholder (company_id) where is_manager;

create table if not exists public.company_name_request (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  proposed_name text not null check (char_length(btrim(proposed_name)) between 3 and 60),
  rank integer not null check (rank >= 1),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'REJECTED' or rejection_reason is not null),
  unique (company_id, rank)
);

create unique index if not exists company_name_request_unique_name_idx
  on public.company_name_request (company_id, lower(btrim(proposed_name)));
create unique index if not exists company_name_request_one_approved_idx
  on public.company_name_request (company_id) where status = 'APPROVED';

create table if not exists public.company_document (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  required_document_id uuid not null references public.required_document(id),
  -- which shareholder / manager the document is about (null = the company)
  shareholder_id uuid,
  file_url text not null,
  file_name text not null default '',
  file_size integer not null default 0,
  status text not null default 'UPLOADED' check (status in ('UPLOADED', 'VALIDATED', 'REJECTED')),
  created_at timestamptz not null default now(),
  foreign key (shareholder_id, company_id)
    references public.shareholder(id, company_id) on delete cascade
);

create unique index if not exists company_document_unique_idx
  on public.company_document (
    company_id,
    required_document_id,
    coalesce(shareholder_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.company_payment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.company(id) on delete cascade,
  reference text not null unique,
  package_price_aed numeric(12, 2) not null check (package_price_aed >= 0),
  office_price_aed numeric(12, 2) not null check (office_price_aed >= 0),
  mao_fee_aed numeric(12, 2) not null check (mao_fee_aed >= 0),
  total_aed numeric(12, 2) not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (total_aed = package_price_aed + office_price_aed + mao_fee_aed),
  check ((status = 'PAID') = (paid_at is not null))
);

-- ======================================================== visa application

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'visa_application'
      and column_name = 'linked_societe_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'visa_application'
      and column_name = 'company_id'
  ) then
    alter table public.visa_application rename column linked_societe_id to company_id;
  end if;
end $$;

alter table public.visa_application
  add column if not exists company_id uuid,
  add column if not exists person_id uuid references public.person(id);
-- (the foreign key company_id -> company(id) is added by 0007, once the legacy
-- identifiers have been carried over)

-- ================================================================ functions

create or replace function public.company_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Appends every status change to company.status_history.
create or replace function public.company_track_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if jsonb_array_length(new.status_history) = 0 then
      new.status_history := jsonb_build_array(
        jsonb_build_object('status', new.status, 'changed_at', now())
      );
    end if;
  elsif new.status is distinct from old.status then
    new.status_history := old.status_history ||
      jsonb_build_array(jsonb_build_object('status', new.status, 'changed_at', now()));
  end if;
  return new;
end $$;

-- Price quote of a company: authority package (by legal form and visa count)
-- + yearly office price + MAO fee.
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

  select o.annual_price_aed into v_office
    from public.authority_office_option o
   where o.authority_id = c.authority_id and o.office_type_id = c.office_type_id;

  select f.fee_aed into v_fee
    from public.mao_fee f
   where f.jurisdiction_type = c.jurisdiction_type
     and f.valid_from <= current_date
     and (f.valid_to is null or f.valid_to >= current_date)
   order by f.valid_from desc
   limit 1;

  return query select v_package, v_office, coalesce(v_fee, 0),
                      v_package + v_office + coalesce(v_fee, 0);
end $$;

-- Documents expected for a company, one row per (required document,
-- shareholder) and whether a usable file was uploaded.
create or replace function public.company_document_checklist(p_company uuid)
returns table (
  required_document_id uuid,
  code text,
  label text,
  applies_to text,
  shareholder_id uuid,
  provided boolean
)
language sql stable as $$
  with c as (select * from public.company where id = p_company),
  rd as (
    select r.*
      from public.required_document r, c
     where r.authority_id = c.authority_id
       and (r.legal_form_id is null or r.legal_form_id = c.legal_form_id)
       and (
         r.activity_id is null
         or exists (
           select 1 from public.company_activity ca
            where ca.company_id = c.id and ca.activity_id = r.activity_id
         )
       )
  ),
  expected as (
    select rd.id as rdid, rd.code, rd.label, rd.applies_to, null::uuid as sid
      from rd where rd.applies_to = 'COMPANY'
    union all
    select rd.id, rd.code, rd.label, rd.applies_to, s.id
      from rd join public.shareholder s on s.company_id = p_company
     where rd.applies_to = 'SHAREHOLDER' and s.person_id is not null
    union all
    select rd.id, rd.code, rd.label, rd.applies_to, s.id
      from rd join public.shareholder s on s.company_id = p_company
     where rd.applies_to = 'MANAGER' and s.is_manager
    union all
    select rd.id, rd.code, rd.label, rd.applies_to, s.id
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
         )
    from expected e
$$;

-- ================================================================= triggers

-- authority_legal_form: same jurisdiction, FREELANCE only where allowed.
create or replace function public.authority_legal_form_guard()
returns trigger language plpgsql as $$
declare
  a public.authority;
  lf public.legal_form;
begin
  select * into a from public.authority where id = new.authority_id;
  select * into lf from public.legal_form where id = new.legal_form_id;
  if a.jurisdiction_type <> lf.jurisdiction_type then
    raise exception 'authority_legal_form: legal form % is not a % legal form',
      lf.code, a.jurisdiction_type using errcode = '23514';
  end if;
  if new.client_choice = 'FREELANCE' and not a.allows_freelance then
    raise exception 'authority_legal_form: authority % does not allow freelance', a.code
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists authority_legal_form_guard on public.authority_legal_form;
create trigger authority_legal_form_guard
  before insert or update on public.authority_legal_form
  for each row execute function public.authority_legal_form_guard();

-- activity: an activity that needs an external approval can still exist in the
-- catalogue (it is simply never selectable in V1, see company_activity_guard).

-- company: configuration rules (any status).
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
  v_unverified integer;
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

        select count(*) into v_unverified from public.shareholder
         where company_id = new.id and person_id is not null
           and (share_pct > 0 or is_manager) and kyc_status <> 'VERIFIED';
        if v_unverified > 0 then
          raise exception 'company_submission: KYC must be VERIFIED for every shareholder and the manager'
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

drop trigger if exists company_guard on public.company;
create trigger company_guard
  before insert or update on public.company
  for each row execute function public.company_guard();

drop trigger if exists company_track_status on public.company;
create trigger company_track_status
  before insert or update on public.company
  for each row execute function public.company_track_status();

drop trigger if exists company_touch on public.company;
create trigger company_touch
  before update on public.company
  for each row execute function public.company_touch();

-- company_activity: same authority, same licence type, no external approval,
-- only while the company is a DRAFT.
create or replace function public.company_activity_guard()
returns trigger language plpgsql as $$
declare
  c public.company;
  a public.activity;
  v_status text;
begin
  if tg_op = 'DELETE' then
    select status into v_status from public.company where id = old.company_id;
    if v_status is not null and v_status <> 'DRAFT'
       and not exists (select 1 from public.company where id = old.company_id and is_legacy) then
      raise exception 'company_activity: activities are frozen after submission'
        using errcode = '23514';
    end if;
    return old;
  end if;

  select * into c from public.company where id = new.company_id;
  select * into a from public.activity where id = new.activity_id;

  if c.status <> 'DRAFT' and not c.is_legacy then
    raise exception 'company_activity: activities are frozen after submission'
      using errcode = '23514';
  end if;
  if c.authority_id is null then
    raise exception 'company_activity: choose the authority first' using errcode = '23514';
  end if;
  if a.authority_id <> c.authority_id then
    raise exception 'company_activity: activity % does not belong to the company authority', a.code
      using errcode = '23514';
  end if;
  if a.requires_external_approval then
    raise exception 'company_activity: activity % needs an external approval (not available in V1)', a.code
      using errcode = '23514';
  end if;
  if c.licence_type_id is not null and a.licence_type_id <> c.licence_type_id then
    raise exception 'company_activity: activity % is not covered by the company licence type', a.code
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists company_activity_guard on public.company_activity;
create trigger company_activity_guard
  before insert or update or delete on public.company_activity
  for each row execute function public.company_activity_guard();

-- shareholder: frozen after submission; the total can never exceed 100%.
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

drop trigger if exists shareholder_guard on public.shareholder;
create trigger shareholder_guard
  before insert or update or delete on public.shareholder
  for each row execute function public.shareholder_guard();

-- company_name_request: new proposals only while DRAFT or after a refusal.
create or replace function public.company_name_request_guard()
returns trigger language plpgsql as $$
declare
  v_status text;
  v_legacy boolean;
begin
  if tg_op = 'INSERT' then
    select status, is_legacy into v_status, v_legacy from public.company where id = new.company_id;
    if not v_legacy and v_status not in ('DRAFT', 'NAME_REJECTED') then
      raise exception 'company_name_request: names can only be proposed in DRAFT or NAME_REJECTED'
        using errcode = '23514';
    end if;
    if new.status <> 'PENDING' then
      raise exception 'company_name_request: a new proposal starts PENDING' using errcode = '23514';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.proposed_name is distinct from old.proposed_name
       or new.rank is distinct from old.rank
       or new.company_id is distinct from old.company_id then
      select status, is_legacy into v_status, v_legacy from public.company where id = new.company_id;
      if not v_legacy and v_status <> 'DRAFT' then
        raise exception 'company_name_request: a submitted name cannot be edited' using errcode = '23514';
      end if;
    end if;
    if new.status is distinct from old.status then
      if old.status <> 'PENDING' then
        raise exception 'company_name_request: a decided name cannot change' using errcode = '23514';
      end if;
      new.decided_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists company_name_request_guard on public.company_name_request;
create trigger company_name_request_guard
  before insert or update on public.company_name_request
  for each row execute function public.company_name_request_guard();

-- company_document: the document must belong to the company's authority and
-- target the right kind of holder.
create or replace function public.company_document_guard()
returns trigger language plpgsql as $$
declare
  c public.company;
  rd public.required_document;
  s public.shareholder;
begin
  select * into c from public.company where id = new.company_id;
  select * into rd from public.required_document where id = new.required_document_id;
  if rd.authority_id is distinct from c.authority_id then
    raise exception 'company_document: this document is not required by the company authority'
      using errcode = '23514';
  end if;
  if rd.legal_form_id is not null and rd.legal_form_id is distinct from c.legal_form_id then
    raise exception 'company_document: this document does not apply to the company legal form'
      using errcode = '23514';
  end if;
  if rd.applies_to = 'COMPANY' then
    if new.shareholder_id is not null then
      raise exception 'company_document: a company document has no shareholder' using errcode = '23514';
    end if;
  else
    if new.shareholder_id is null then
      raise exception 'company_document: choose the shareholder this document is about' using errcode = '23514';
    end if;
    select * into s from public.shareholder where id = new.shareholder_id;
    if rd.applies_to = 'MANAGER' and not s.is_manager then
      raise exception 'company_document: this document is for the manager' using errcode = '23514';
    elsif rd.applies_to = 'SHAREHOLDER' and s.person_id is null then
      raise exception 'company_document: this document is for a natural person' using errcode = '23514';
    elsif rd.applies_to = 'PARENT_COMPANY' and s.parent_company_id is null then
      raise exception 'company_document: this document is for a parent company' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists company_document_guard on public.company_document;
create trigger company_document_guard
  before insert or update on public.company_document
  for each row execute function public.company_document_guard();

-- company_payment: amounts must be the ones quoted by the database.
create or replace function public.company_payment_guard()
returns trigger language plpgsql as $$
declare
  q record;
  v_status text;
begin
  select status into v_status from public.company where id = new.company_id;
  if v_status <> 'DRAFT' and tg_op = 'INSERT' then
    raise exception 'company_payment: the company is already submitted' using errcode = '23514';
  end if;
  select * into q from public.company_quote(new.company_id);
  if new.package_price_aed <> q.package_price_aed
     or new.office_price_aed <> q.office_price_aed
     or new.mao_fee_aed <> q.mao_fee_aed then
    raise exception 'company_payment: amounts do not match the quote' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists company_payment_guard on public.company_payment;
create trigger company_payment_guard
  before insert or update of package_price_aed, office_price_aed, mao_fee_aed
  on public.company_payment
  for each row execute function public.company_payment_guard();

-- visa_application: a visa is a separate procedure, only started once the
-- licence is issued, and within the company's visa quota.
create or replace function public.visa_application_guard()
returns trigger language plpgsql as $$
declare
  c public.company;
  v_used integer;
begin
  if new.company_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.company_id is not distinct from old.company_id then
    return new;
  end if;
  select * into c from public.company where id = new.company_id;
  if not found then
    raise exception 'visa_application: unknown company' using errcode = '23503';
  end if;
  if c.status <> 'LICENCE_ISSUED' then
    raise exception 'visa_application: the company licence must be issued first (status %)', c.status
      using errcode = '23514';
  end if;
  select count(*) into v_used from public.visa_application
   where company_id = new.company_id
     and id is distinct from new.id
     and coalesce(decision_status, 'en_attente') <> 'rejete';
  -- (a legacy company carried over without a quota is not capped)
  if c.visa_quota is not null and v_used + 1 > c.visa_quota then
    raise exception 'visa_application: visa quota reached (% of %)', v_used, c.visa_quota
      using errcode = '23514';
  end if;
  return new;
end $$;

-- ===================================================================== RLS

alter table public.jurisdiction_type enable row level security;
alter table public.authority enable row level security;
alter table public.legal_form enable row level security;
alter table public.authority_legal_form enable row level security;
alter table public.licence_type enable row level security;
alter table public.activity enable row level security;
alter table public.office_type enable row level security;
alter table public.authority_office_option enable row level security;
alter table public.authority_pricing enable row level security;
alter table public.required_document enable row level security;
alter table public.mao_fee enable row level security;
alter table public.person enable row level security;
alter table public.parent_company enable row level security;
alter table public.company enable row level security;
alter table public.company_activity enable row level security;
alter table public.shareholder enable row level security;
alter table public.company_name_request enable row level security;
alter table public.company_document enable row level security;
alter table public.company_payment enable row level security;

-- Reference data: read-only for the app (maintained from the SQL editor).
do $$
declare
  t text;
begin
  foreach t in array array[
    'jurisdiction_type', 'authority', 'legal_form', 'authority_legal_form',
    'licence_type', 'activity', 'office_type', 'authority_office_option',
    'authority_pricing', 'required_document', 'mao_fee'
  ] loop
    execute format('drop policy if exists "Demo: anyone can read %1$s" on public.%1$I', t);
    execute format(
      'create policy "Demo: anyone can read %1$s" on public.%1$I for select to anon, authenticated using (true)',
      t
    );
  end loop;
end $$;

-- Transactional data. DEMO POLICIES ONLY — same caveat as the other tables
-- (no per-user scoping: the anon key can read/write everything).
do $$
declare
  t text;
begin
  foreach t in array array[
    'person', 'parent_company', 'company', 'company_activity', 'shareholder',
    'company_name_request', 'company_document', 'company_payment'
  ] loop
    execute format('drop policy if exists "Demo: anyone can read %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Demo: anyone can insert %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Demo: anyone can update %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Demo: anyone can delete %1$s" on public.%1$I', t);
    execute format(
      'create policy "Demo: anyone can read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "Demo: anyone can insert %1$s" on public.%1$I for insert to anon, authenticated with check (true)', t);
    execute format(
      'create policy "Demo: anyone can update %1$s" on public.%1$I for update to anon, authenticated using (true) with check (true)', t);
    execute format(
      'create policy "Demo: anyone can delete %1$s" on public.%1$I for delete to anon, authenticated using (true)', t);
  end loop;
end $$;
