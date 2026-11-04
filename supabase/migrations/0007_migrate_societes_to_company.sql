-- Migration: move the legacy `societes` table into the new `company` model.
--
-- Run after 0006_company_model.sql. What it does, in order:
--   1. copies every row of `societes` into `company` (SAME id, is_legacy =
--      true) so that links held by other tables stay valid, together with its
--      three proposed names and its contacts (as persons / shareholders);
--   2. re-points support_tickets (societe_* -> company_*), societe_users
--      (-> company_user) and visa_application to `company`;
--   3. attaches the visa guard trigger (a visa needs an issued licence and
--      must stay within the visa quota);
--   4. renames `societes` to `societes_legacy` (kept for reference; nothing
--      reads it any more — drop it yourself once you have checked the copy).
--
-- Legacy status mapping: nouveau -> DRAFT, soumis -> SUBMITTED, valide ->
-- NAME_APPROVED, valide + licence number -> LICENCE_ISSUED, rejete -> REJECTED.
-- Legacy rows have no authority / legal form / office: they are flagged
-- is_legacy so the completeness CHECKs and the structure freeze do not apply
-- to them. Their former activity data is kept in company.legacy_data.
--
-- Safe to re-run: step 1 only runs while `societes` still exists, the renames
-- and constraint changes are all guarded.
-- ---------------------------------------------------------------------------

-- Source of the copy: `societes`, or `societes_legacy` when a previous run (or
-- a manual rename) already archived it, so rows missing from `company` are
-- still carried over on a re-run.
do $src$
begin
  if to_regclass('public.societes') is not null then
    create or replace temp view _src_societes as select * from public.societes;
  elsif to_regclass('public.societes_legacy') is not null then
    create or replace temp view _src_societes as select * from public.societes_legacy;
  end if;
end
$src$;

do $migrate$
begin
  if to_regclass('pg_temp._src_societes') is null then
    raise notice '0007: no societes / societes_legacy table found, skipping the data copy';
    return;
  end if;

  -- 1. companies ----------------------------------------------------------
  insert into public.company (
    id, created_at, updated_at, jurisdiction_type, trade_name, status,
    licence_number, licence_issued_at, licence_expires_at,
    accounting, tracking_reference, requester_name, rejection_reason,
    status_history, licence_history, licence_renewal_tickets,
    is_legacy, legacy_data
  )
  select
    s.id,
    s.created_at,
    s.updated_at,
    case when s.structure_type = 'mainland' then 'MAINLAND' else 'FREE_ZONE' end,
    case when s.status in ('valide') then coalesce(s.validated_company_name, s.company_name_1) end,
    case
      when s.license ? 'number' and coalesce(s.license ->> 'number', '') <> '' then 'LICENCE_ISSUED'
      when s.status = 'valide' then 'NAME_APPROVED'
      when s.status = 'soumis' then 'SUBMITTED'
      when s.status = 'rejete' then 'REJECTED'
      else 'DRAFT'
    end,
    nullif(s.license ->> 'number', ''),
    (s.license ->> 'issued_at')::timestamptz,
    (s.license ->> 'expires_at')::timestamptz,
    s.accounting,
    s.tracking_reference,
    s.requester_name,
    case when s.status = 'rejete'
         then coalesce(s.rejection_reason, 'Demande rejetée (historique)') end,
    coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'status',
                 case h ->> 'status'
                   when 'nouveau' then 'DRAFT'
                   when 'soumis'  then 'SUBMITTED'
                   when 'valide'  then 'NAME_APPROVED'
                   when 'rejete'  then 'REJECTED'
                   else h ->> 'status'
                 end,
                 'changed_at', h ->> 'changed_at'
               )
               order by ord
             )
        from jsonb_array_elements(s.status_history) with ordinality as t(h, ord)
    ), '[]'::jsonb),
    s.license_history,
    s.license_renewal_tickets,
    true,
    jsonb_build_object(
      'structure_type', s.structure_type,
      'free_zone_id', s.free_zone_id,
      'free_zone_name', s.free_zone_name,
      'free_zone_emirate', s.free_zone_emirate,
      'activity_category', s.activity_category,
      'activity_description', s.activity_description,
      'license_type', s.license ->> 'type',
      'documents', s.documents
    )
  from _src_societes s
  where not exists (select 1 from public.company c where c.id = s.id);

  -- the three proposed names (kept as PENDING, then decided for validated rows)
  insert into public.company_name_request (company_id, proposed_name, rank)
  select s.id, btrim(n.name), n.rank
    from _src_societes s
    cross join lateral (values
      (s.company_name_1, 1), (s.company_name_2, 2), (s.company_name_3, 3)
    ) as n(name, rank)
   where char_length(btrim(coalesce(n.name, ''))) between 3 and 60
  on conflict do nothing;

  update public.company_name_request r
     set status = case
           when lower(btrim(r.proposed_name)) = lower(btrim(c.trade_name)) then 'APPROVED'
           else 'REJECTED'
         end,
         rejection_reason = case
           when lower(btrim(r.proposed_name)) = lower(btrim(c.trade_name)) then null
           else 'Non retenu (société historique)'
         end
    from public.company c
   where c.id = r.company_id
     and c.is_legacy
     and c.status in ('NAME_APPROVED', 'LICENCE_ISSUED')
     and c.trade_name is not null
     and r.status = 'PENDING';

  -- contacts -> persons + shareholders (equal split, first one is the manager)
  with contacts as (
    select s.id as company_id,
           e.sh,
           e.ord,
           count(*) over (partition by s.id) as n,
           gen_random_uuid() as person_id
      from _src_societes s
      cross join lateral jsonb_array_elements(coalesce(s.shareholders, '[]'::jsonb))
           with ordinality as e(sh, ord)
     where coalesce(btrim(e.sh ->> 'nom'), '') <> '' or coalesce(btrim(e.sh ->> 'prenom'), '') <> ''
  ),
  new_persons as (
    insert into public.person (id, first_name, last_name, email, phone)
    select person_id,
           coalesce(nullif(btrim(sh ->> 'prenom'), ''), '-'),
           coalesce(nullif(btrim(sh ->> 'nom'), ''), '-'),
           nullif(btrim(sh ->> 'email'), ''),
           nullif(btrim(sh ->> 'telephone'), '')
      from contacts
    returning id
  )
  insert into public.shareholder (company_id, person_id, share_pct, is_manager)
  select c.company_id,
         c.person_id,
         case when c.ord = 1
              then 100 - floor(10000.0 / c.n) / 100 * (c.n - 1)
              else floor(10000.0 / c.n) / 100
         end,
         c.ord = 1
    from contacts c
    join new_persons p on p.id = c.person_id;
end
$migrate$;

-- 2a. support tickets ------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'support_tickets'
                and column_name = 'societe_id') then
    alter table public.support_tickets rename column societe_id to company_id;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'support_tickets'
                and column_name = 'societe_name') then
    alter table public.support_tickets rename column societe_name to company_name;
  end if;

  alter table public.support_tickets drop constraint if exists support_tickets_societe_id_fkey;
  if not exists (select 1 from pg_constraint
                  where conname = 'support_tickets_company_id_fkey'
                    and conrelid = 'public.support_tickets'::regclass) then
    alter table public.support_tickets
      add constraint support_tickets_company_id_fkey
      foreign key (company_id) references public.company(id) on delete set null;
  end if;
end $$;

-- 2b. société users -> company_user ------------------------------------------
do $$
declare
  p record;
begin
  if to_regclass('public.societe_users') is not null
     and to_regclass('public.company_user') is null then
    alter table public.societe_users rename to company_user;
    for p in select policyname from pg_policies
              where schemaname = 'public' and tablename = 'company_user' loop
      execute format('drop policy %I on public.company_user', p.policyname);
    end loop;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'company_user'
                and column_name = 'societe_id') then
    alter table public.company_user rename column societe_id to company_id;
  end if;

  alter table public.company_user drop constraint if exists societe_users_societe_id_fkey;
  if not exists (select 1 from pg_constraint
                  where conname = 'company_user_company_id_fkey'
                    and conrelid = 'public.company_user'::regclass) then
    alter table public.company_user
      add constraint company_user_company_id_fkey
      foreign key (company_id) references public.company(id) on delete cascade;
  end if;
end $$;

alter index if exists public.societe_users_societe_id_idx rename to company_user_company_id_idx;

alter table public.company_user enable row level security;

drop policy if exists "Demo: anyone can read company_user" on public.company_user;
create policy "Demo: anyone can read company_user"
  on public.company_user for select to anon, authenticated using (true);
drop policy if exists "Demo: anyone can insert company_user" on public.company_user;
create policy "Demo: anyone can insert company_user"
  on public.company_user for insert to anon, authenticated with check (true);
drop policy if exists "Demo: anyone can update company_user" on public.company_user;
create policy "Demo: anyone can update company_user"
  on public.company_user for update to anon, authenticated using (true) with check (true);
drop policy if exists "Demo: anyone can delete company_user" on public.company_user;
create policy "Demo: anyone can delete company_user"
  on public.company_user for delete to anon, authenticated using (true);

-- 3. visa applications -----------------------------------------------------
-- Visas pointing at a société that exists nowhere (neither in company nor in the
-- archive) cannot satisfy the new foreign key: keep the old id in
-- legacy_company_id and unlink them, instead of failing the whole migration.
alter table public.visa_application add column if not exists legacy_company_id uuid;

update public.visa_application v
   set legacy_company_id = coalesce(v.legacy_company_id, v.company_id),
       company_id = null
 where v.company_id is not null
   and not exists (select 1 from public.company c where c.id = v.company_id);

do $$
begin
  alter table public.visa_application drop constraint if exists visa_application_linked_societe_id_fkey;
  if not exists (select 1 from pg_constraint
                  where conname = 'visa_application_company_id_fkey'
                    and conrelid = 'public.visa_application'::regclass) then
    alter table public.visa_application
      add constraint visa_application_company_id_fkey
      foreign key (company_id) references public.company(id);
  end if;
end $$;

create index if not exists visa_application_company_id_idx
  on public.visa_application (company_id);

drop trigger if exists visa_application_guard on public.visa_application;
create trigger visa_application_guard
  before insert or update of company_id on public.visa_application
  for each row execute function public.visa_application_guard();

-- 4. archive the old table ---------------------------------------------------
do $$
begin
  if to_regclass('public.societes') is not null
     and to_regclass('public.societes_legacy') is null then
    alter table public.societes rename to societes_legacy;
  end if;
end $$;

comment on table public.societes_legacy is
  'Archive of the former societes table, copied into company by migration 0007. Not read by the app; drop once the copy has been checked.';
