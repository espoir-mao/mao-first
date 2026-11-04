-- Database-level tests of the company model rules (0006 + 0007 + demo seed).
-- Run it in the Supabase SQL editor (or: psql -f supabase/tests/company_constraints.sql).
-- The whole script is ONE statement (a DO block), so it is a single transaction
-- even in the Supabase SQL editor, which runs statements separately. It always
-- ends with an exception that rolls everything back: the message
-- "TESTS OK: n checks passed" is the success result; any other message is a failure.
-- Each negative test must FAIL with the expected message; the happy path must
-- go through. Any surprise raises an exception and stops the script.
do $outer$
begin

create table public.zz_log(label text);

create function public.zz_expect_error(p_label text, p_sql text, p_expected text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_expected || '%' then
      insert into public.zz_log values (p_label);
      return;
    end if;
    raise exception 'FAIL - %: wrong error "%" (expected "%")', p_label, sqlerrm, p_expected;
  end;
  raise exception 'FAIL - %: statement succeeded but must be rejected', p_label;
end $$;

create function public.zz_id(p_table text, p_code text) returns uuid language plpgsql as $$
declare r uuid;
begin
  execute format('select id from public.%I where code = %L', p_table, p_code) into r;
  if r is null then raise exception 'unknown % %', p_table, p_code; end if;
  return r;
end $$;

-- ------------------------------------------------------------- structure rules
perform public.zz_expect_error('mainland legal form in a free zone',
  format($q$insert into company (jurisdiction_type, authority_id, legal_form_id, client_choice)
            values ('FREE_ZONE', %L, %L, 'MULTI')$q$, public.zz_id('authority','IFZA'), public.zz_id('legal_form','LLC')),
  'violates foreign key');

perform public.zz_expect_error('legal form not matching the client choice',
  format($q$insert into company (jurisdiction_type, authority_id, legal_form_id, client_choice)
            values ('FREE_ZONE', %L, %L, 'MULTI')$q$, public.zz_id('authority','IFZA'), public.zz_id('legal_form','FZE')),
  'violates foreign key');

perform public.zz_expect_error('legal form without authority',
  format($q$insert into company (jurisdiction_type, legal_form_id) values ('FREE_ZONE', %L)$q$,
         public.zz_id('legal_form','FZE')),
  'violates check constraint');

perform public.zz_expect_error('authority with the wrong jurisdiction',
  format($q$insert into company (jurisdiction_type, authority_id) values ('MAINLAND', %L)$q$,
         public.zz_id('authority','IFZA')),
  'violates foreign key');

perform public.zz_expect_error('freelance on an authority that forbids it',
  format($q$insert into authority_legal_form (authority_id, legal_form_id, client_choice)
            values (%L, %L, 'FREELANCE')$q$, public.zz_id('authority','RAKEZ'), public.zz_id('legal_form','FREELANCE_PERMIT')),
  'does not allow freelance');

perform public.zz_expect_error('overlapping price period',
  format($q$insert into authority_pricing (authority_id, legal_form_id, visa_count, price_aed, valid_from)
            values (%L, %L, 1, 1, '2026-06-01')$q$, public.zz_id('authority','IFZA'), public.zz_id('legal_form','FZE')),
  'conflicting key value violates exclusion constraint');

perform public.zz_expect_error('price for a pair that is not offered',
  format($q$insert into authority_pricing (authority_id, legal_form_id, visa_count, price_aed)
            values (%L, %L, 1, 1)$q$, public.zz_id('authority','IFZA'), public.zz_id('legal_form','LLC')),
  'violates foreign key');

-- -------------------------------------------------- company: office and visas
perform public.zz_expect_error('visa quota above the office maximum',
  format($q$insert into company (jurisdiction_type, authority_id, legal_form_id, client_choice, office_type_id, visa_quota)
            values ('FREE_ZONE', %L, %L, 'SOLO', %L, 3)$q$,
         public.zz_id('authority','IFZA'), public.zz_id('legal_form','FZE'), public.zz_id('office_type','FLEXI_DESK')),
  'exceeds the 2 allowed');

perform public.zz_expect_error('office not offered by the authority',
  format($q$insert into company (jurisdiction_type, authority_id, legal_form_id, client_choice, office_type_id, visa_quota)
            values ('FREE_ZONE', %L, %L, 'SOLO', %L, 1)$q$,
         public.zz_id('authority','IFZA'), public.zz_id('legal_form','FZE'), public.zz_id('office_type','EJARI_OFFICE')),
  'violates foreign key');

-- make the mainland authority offer a non-Ejari office to reach the Ejari rule
insert into authority_office_option (authority_id, office_type_id, visa_quota_max, annual_price_aed)
values (public.zz_id('authority','DET_DXB'), public.zz_id('office_type','FLEXI_DESK'), 2, 1000);
perform public.zz_expect_error('mainland without Ejari',
  format($q$insert into company (jurisdiction_type, authority_id, legal_form_id, client_choice, office_type_id, visa_quota)
            values ('MAINLAND', %L, %L, 'SOLO', %L, 1)$q$,
         public.zz_id('authority','DET_DXB'), public.zz_id('legal_form','SOLE_EST'), public.zz_id('office_type','FLEXI_DESK')),
  'needs an office with Ejari');

-- ------------------------------------------------------- a working draft (MEYDAN)
create table public.zz_test_t(company uuid, person uuid, sh uuid);
insert into public.zz_test_t(company) values (gen_random_uuid());
insert into company (id, jurisdiction_type, authority_id, legal_form_id, client_choice, licence_type_id, office_type_id, visa_quota)
select company, 'FREE_ZONE', public.zz_id('authority','MEYDAN'), public.zz_id('legal_form','FZE'), 'SOLO',
       public.zz_id('licence_type','PROFESSIONAL'), public.zz_id('office_type','FLEXI_DESK'), 1
  from public.zz_test_t;

-- activities
perform public.zz_expect_error('activity of another authority',
  format($q$insert into company_activity (company_id, activity_id)
            select %L, id from activity where code = 'IT_SOFTWARE' and authority_id = %L$q$,
         (select company from public.zz_test_t), public.zz_id('authority','IFZA')),
  'does not belong to the company authority');
perform public.zz_expect_error('activity needing an external approval',
  format($q$insert into company_activity (company_id, activity_id)
            select %L, id from activity where code = 'HEALTHCARE' and authority_id = %L$q$,
         (select company from public.zz_test_t), public.zz_id('authority','MEYDAN')),
  'needs an external approval');
perform public.zz_expect_error('activity of another licence type',
  format($q$insert into company_activity (company_id, activity_id)
            select %L, id from activity where code = 'TRADING_GENERAL' and authority_id = %L$q$,
         (select company from public.zz_test_t), public.zz_id('authority','MEYDAN')),
  'not covered by the company licence type');
insert into company_activity (company_id, activity_id)
select (select company from public.zz_test_t), id from activity
 where code in ('IT_SOFTWARE', 'ENGINEERING') and authority_id = public.zz_id('authority','MEYDAN');
perform public.zz_expect_error('changing the authority with activities attached',
  format($q$update company set authority_id = %L where id = %L$q$, public.zz_id('authority','IFZA'), (select company from public.zz_test_t)),
  'remove the activities');

-- submission refused while incomplete
perform public.zz_expect_error('submit without names',
  format($q$update company set status = 'SUBMITTED' where id = %L$q$, (select company from public.zz_test_t)),
  '3 name proposals');
insert into company_name_request (company_id, proposed_name, rank)
select company, n, r from public.zz_test_t, (values ('Nova Labs', 1), ('Nova Studio', 2), ('Nova Works', 3)) v(n, r);
perform public.zz_expect_error('duplicate name',
  format($q$insert into company_name_request (company_id, proposed_name, rank) values (%L, ' nova labs ', 4)$q$, (select company from public.zz_test_t)),
  'unique');
perform public.zz_expect_error('rejected name without reason',
  format($q$update company_name_request set status = 'REJECTED' where company_id = %L and rank = 3$q$, (select company from public.zz_test_t)),
  'violates check constraint');

perform public.zz_expect_error('submit without shareholders',
  format($q$update company set status = 'SUBMITTED' where id = %L$q$, (select company from public.zz_test_t)),
  'shares must add up to 100');

-- shareholders
insert into person (first_name, last_name) values ('Amina', 'Test');
update public.zz_test_t set person = (select id from person where last_name = 'Test');
perform public.zz_expect_error('shares above 100',
  format($q$insert into shareholder (company_id, person_id, share_pct) values (%L, %L, 101)$q$, (select company from public.zz_test_t), (select person from public.zz_test_t)),
  'exceed 100');
perform public.zz_expect_error('manager that is a company',
  format($q$insert into shareholder (company_id, parent_company_id, share_pct, is_manager)
            values (%L, gen_random_uuid(), 50, true)$q$, (select company from public.zz_test_t)),
  'violates');
insert into shareholder (company_id, person_id, share_pct, is_manager)
values ((select company from public.zz_test_t), (select person from public.zz_test_t), 100, true);
update public.zz_test_t set sh = (select id from shareholder where company_id = (select company from public.zz_test_t));

-- KYC is MAO's job during the review: it cannot start while the file is a DRAFT
perform public.zz_expect_error('KYC started by the client on a DRAFT',
  format($q$update shareholder set kyc_status = 'PENDING' where id = %L$q$, (select sh from public.zz_test_t)),
  'KYC is run by MAO');

perform public.zz_expect_error('submit with documents missing',
  format($q$update company set status = 'SUBMITTED' where id = %L$q$, (select company from public.zz_test_t)),
  'document(s) missing');

-- documents: wrong holder / wrong authority
perform public.zz_expect_error('document of another authority',
  format($q$insert into company_document (company_id, required_document_id, shareholder_id, file_url)
            select %L, id, %L, 'x' from required_document
             where code = 'PASSPORT' and authority_id = %L$q$, (select company from public.zz_test_t), (select sh from public.zz_test_t), public.zz_id('authority','IFZA')),
  'not required by the company authority');
perform public.zz_expect_error('parent-company document attached to a person',
  format($q$insert into company_document (company_id, required_document_id, shareholder_id, file_url)
            select %L, id, %L, 'x' from required_document
             where code = 'PARENT_MOA' and authority_id = %L$q$, (select company from public.zz_test_t), (select sh from public.zz_test_t), public.zz_id('authority','MEYDAN')),
  'for a parent company');
insert into company_document (company_id, required_document_id, shareholder_id, file_url)
select (select company from public.zz_test_t), r.required_document_id, r.shareholder_id, 'demo://file'
  from company_document_checklist((select company from public.zz_test_t)) r
 where not r.provided;
perform 'checklist rows: ' || count(*) || ', missing: ' || count(*) filter (where not provided) from company_document_checklist((select company from public.zz_test_t));

perform public.zz_expect_error('submit without payment',
  format($q$update company set status = 'SUBMITTED' where id = %L$q$, (select company from public.zz_test_t)),
  'payment must be PAID');
perform public.zz_expect_error('payment with a tampered amount',
  format($q$insert into company_payment (company_id, reference, package_price_aed, office_price_aed, mao_fee_aed, total_aed)
            values (%L, 'PAY-X', 1, 1, 1, 3)$q$, (select company from public.zz_test_t)),
  'do not match the quote');
insert into company_payment (company_id, reference, package_price_aed, office_price_aed, mao_fee_aed, total_aed)
select company, 'PAY-1', q.package_price_aed, q.office_price_aed, q.mao_fee_aed, q.total_aed
  from public.zz_test_t, company_quote((select company from public.zz_test_t)) q;
perform public.zz_expect_error('submit with a pending payment',
  format($q$update company set status = 'SUBMITTED' where id = %L$q$, (select company from public.zz_test_t)),
  'payment must be PAID');
update company_payment set status = 'PAID', paid_at = now();

-- visa before the licence
perform public.zz_expect_error('visa before submission',
  format($q$insert into visa_application (visa_type, company_id) values ('investor', %L)$q$, (select company from public.zz_test_t)),
  'licence must be issued first');

-- the state machine
perform public.zz_expect_error('skipping states',
  format($q$update company set status = 'LICENCE_ISSUED' where id = %L$q$, (select company from public.zz_test_t)),
  'is not allowed');
update company set status = 'SUBMITTED' where id = (select company from public.zz_test_t);
perform public.zz_expect_error('structure change after submission',
  format($q$update company set visa_quota = 0 where id = %L$q$, (select company from public.zz_test_t)),
  'cannot change after submission');
perform public.zz_expect_error('shareholder edit after submission',
  format($q$update shareholder set share_pct = 50 where id = %L$q$, (select sh from public.zz_test_t)),
  'frozen after submission');
perform public.zz_expect_error('activity removal after submission',
  format($q$delete from company_activity where company_id = %L$q$, (select company from public.zz_test_t)),
  'frozen after submission');
update company set status = 'IN_REVIEW' where id = (select company from public.zz_test_t);
perform public.zz_expect_error('NAME_APPROVED without an approved name',
  format($q$update company set status = 'NAME_APPROVED', trade_name = 'Nova Labs' where id = %L$q$, (select company from public.zz_test_t)),
  'needs an APPROVED name request');

-- name refused path: all three refused -> NAME_REJECTED -> new proposals
update company_name_request set status = 'REJECTED', rejection_reason = 'Contains a restricted word' where company_id = (select company from public.zz_test_t);
update company set status = 'NAME_REJECTED' where id = (select company from public.zz_test_t);
insert into company_name_request (company_id, proposed_name, rank)
select company, 'Orbit Labs', 4 from public.zz_test_t;
update company set status = 'IN_REVIEW' where id = (select company from public.zz_test_t);
update company_name_request set status = 'APPROVED' where company_id = (select company from public.zz_test_t) and rank = 4;
perform public.zz_expect_error('NAME_APPROVED with a different trade name',
  format($q$update company set status = 'NAME_APPROVED', trade_name = 'Other' where id = %L$q$, (select company from public.zz_test_t)),
  'needs an APPROVED name request');
perform public.zz_expect_error('NAME_APPROVED with KYC not verified',
  format($q$update company set status = 'NAME_APPROVED', trade_name = 'Orbit Labs' where id = %L$q$, (select company from public.zz_test_t)),
  'KYC must be VERIFIED');
-- KYC run by MAO during the review (simulated)
update shareholder set kyc_status = 'PENDING', kyc_reference = 'SIM-1' where id = (select sh from public.zz_test_t);
update shareholder set kyc_status = 'VERIFIED', kyc_checked_at = now() where id = (select sh from public.zz_test_t);

-- correction requests raised by MAO
perform public.zz_expect_error('company correction on a visa section',
  format($q$insert into company_correction_request (reference, company_id, section, message)
            values ('COR-X', %L, 'VISA_OTHER', 'Please check the visa form')$q$, (select company from public.zz_test_t)),
  'violates check constraint');
perform public.zz_expect_error('correction message too short',
  format($q$insert into company_correction_request (reference, company_id, section, message)
            values ('COR-X', %L, 'DOCUMENTS', 'no')$q$, (select company from public.zz_test_t)),
  'violates check constraint');
insert into company_correction_request (reference, company_id, section, message)
select 'COR-1', company, 'DOCUMENTS', 'The passport scan is unreadable, please upload it again' from public.zz_test_t;
perform public.zz_expect_error('correction edited',
  $q$update company_correction_request set message = 'something else entirely' where reference = 'COR-1'$q$,
  'cannot be edited');
perform public.zz_expect_error('NAME_APPROVED with an open correction',
  format($q$update company set status = 'NAME_APPROVED', trade_name = 'Orbit Labs' where id = %L$q$, (select company from public.zz_test_t)),
  'correction request(s) still pending');
perform public.zz_expect_error('answer without text nor file',
  $q$update company_correction_request set status = 'REPONDU', answered_at = now() where reference = 'COR-1'$q$,
  'violates check constraint');
update company_correction_request set status = 'REPONDU', answered_at = now(),
       response = 'Uploaded again', response_files = '[{"name":"passport.pdf","url":"demo://p"}]'
 where reference = 'COR-1';
perform public.zz_expect_error('NAME_APPROVED while the answer is not closed',
  format($q$update company set status = 'NAME_APPROVED', trade_name = 'Orbit Labs' where id = %L$q$, (select company from public.zz_test_t)),
  'correction request(s) still pending');
perform public.zz_expect_error('answered request reopened',
  $q$update company_correction_request set status = 'OUVERT', answered_at = null where reference = 'COR-1'$q$,
  'is not allowed');
update company_correction_request set status = 'CLOTURE', closed_at = now() where reference = 'COR-1';
perform public.zz_expect_error('closed request modified',
  $q$update company_correction_request set response = 'late' where reference = 'COR-1'$q$,
  'closed request cannot change');
update company set status = 'NAME_APPROVED', trade_name = 'Orbit Labs' where id = (select company from public.zz_test_t);
update company set status = 'INITIAL_APPROVAL' where id = (select company from public.zz_test_t);
-- waiver: a pending request blocks the next step unless MAO waives it with an explanation
insert into company_correction_request (reference, company_id, section, message)
select 'COR-W', company, 'OTHER', 'Please send the updated trade licence of the parent company' from public.zz_test_t;
perform public.zz_expect_error('LICENCE_ISSUED with a blocking request',
  format($q$update company set status = 'LICENCE_ISSUED', licence_number = 'LIC-W', licence_issued_at = now(), licence_expires_at = now() + interval '1 year' where id = %L$q$, (select company from public.zz_test_t)),
  'correction request(s) still pending');
perform public.zz_expect_error('waiver without explanation',
  $q$update company_correction_request set is_blocking = false where reference = 'COR-W'$q$,
  'violates check constraint');
perform public.zz_expect_error('waiver with a too short explanation',
  $q$update company_correction_request set is_blocking = false, waiver_reason = 'ok' where reference = 'COR-W'$q$,
  'violates check constraint');
perform public.zz_expect_error('request raised non blocking without explanation',
  format($q$insert into company_correction_request (reference, company_id, section, message, is_blocking)
            values ('COR-N', %L, 'OTHER', 'Optional remark on the file', false)$q$, (select company from public.zz_test_t)),
  'violates check constraint');
update company_correction_request set is_blocking = false,
       waiver_reason = 'Document will be provided with the licence renewal' where reference = 'COR-W';
perform public.zz_expect_error('waiver explanation edited',
  $q$update company_correction_request set waiver_reason = 'another explanation here' where reference = 'COR-W'$q$,
  'cannot be edited');
perform public.zz_expect_error('waived request blocking again',
  $q$update company_correction_request set is_blocking = true where reference = 'COR-W'$q$,
  'cannot block again');
if (select waived_at from company_correction_request where reference = 'COR-W') is null then
  raise exception 'FAIL - waived_at should be set';
end if;
perform public.zz_expect_error('licence issued without number',
  format($q$update company set status = 'LICENCE_ISSUED' where id = %L$q$, (select company from public.zz_test_t)),
  'violates check constraint');
update company set status = 'LICENCE_ISSUED', licence_number = 'LIC-DEMO-1',
       licence_issued_at = now(), licence_expires_at = now() + interval '1 year'
 where id = (select company from public.zz_test_t);

-- visas: allowed now, within quota (1)
insert into visa_application (visa_type, company_id) select 'investor', company from public.zz_test_t;
-- a correction on a visa blocks its decision until closed
insert into company_correction_request (reference, company_id, visa_application_id, section, message)
select 'COR-V1', company, (select id from visa_application where company_id = company), 'VISA_DOCUMENTS',
       'The passport copy of the applicant is missing' from public.zz_test_t;
perform public.zz_expect_error('visa granted with an open correction',
  format($q$update visa_application set decision_status = 'obtenu' where company_id = %L$q$, (select company from public.zz_test_t)),
  'correction request is still pending');
update company_correction_request set status = 'CLOTURE', closed_at = now() where reference = 'COR-V1';
update visa_application set decision_status = 'obtenu' where company_id = (select company from public.zz_test_t);
perform public.zz_expect_error('visa over the quota',
  format($q$insert into visa_application (visa_type, company_id) values ('employee', %L)$q$, (select company from public.zz_test_t)),
  'visa quota reached');

perform 'history: ' || string_agg(e ->> 'status', ' > ' order by ord)
  from company, jsonb_array_elements(status_history) with ordinality t(e, ord)
 where id = (select company from public.zz_test_t);


-- --------------------------------- mainland: Ejari lease + optional documents
perform public.zz_expect_error('lease mode on a free zone company',
  $q$insert into company (jurisdiction_type, lease_mode) values ('FREE_ZONE', 'OWN')$q$,
  'violates check constraint');
perform public.zz_expect_error('unknown lease mode',
  format($q$insert into company (jurisdiction_type, lease_mode) values ('MAINLAND', 'LATER')$q$),
  'violates check constraint');
perform public.zz_expect_error('EJARI_LEASE conditioned by something else',
  format($q$update required_document set required_when = 'SOMETHING' where code = 'EJARI_LEASE'$q$),
  'violates check constraint');

create table public.zz_test_m(company uuid, sh uuid);
-- explicit id: the database may already hold other mainland companies
insert into public.zz_test_m(company) values (gen_random_uuid());
insert into company (id, jurisdiction_type, authority_id, legal_form_id, client_choice, licence_type_id, office_type_id, visa_quota)
select company, 'MAINLAND', public.zz_id('authority','DET_DXB'), public.zz_id('legal_form','SOLE_EST'), 'SOLO',
       public.zz_id('licence_type','COMMERCIAL'), public.zz_id('office_type','EJARI_OFFICE'), 1
  from public.zz_test_m;
insert into company_activity (company_id, activity_id)
select (select company from public.zz_test_m), id from activity
 where authority_id = public.zz_id('authority','DET_DXB') and licence_type_id = public.zz_id('licence_type','COMMERCIAL')
 limit 1;
insert into company_name_request (company_id, proposed_name, rank)
select company, n, r from public.zz_test_m, (values ('Dune Trading', 1), ('Dune Goods', 2), ('Dune Supply', 3)) v(n, r);
create temp table zz_p(id uuid);
with p as (insert into person (first_name, last_name) values ('Karim', 'Mainland') returning id)
insert into zz_p select id from p;
insert into shareholder (company_id, person_id, share_pct, is_manager)
select (select company from public.zz_test_m), id, 100, true from zz_p;
update public.zz_test_m set sh = (select id from shareholder where company_id = company);

-- the manager's residence visa is optional: everything else is still asked
perform 'optional rows: ' || count(*) from company_document_checklist((select company from public.zz_test_m)) where optional;
if not exists (select 1 from company_document_checklist((select company from public.zz_test_m))
                where code = 'MANAGER_RESIDENCE' and optional) then
  raise exception 'FAIL - MANAGER_RESIDENCE should be optional';
end if;
if exists (select 1 from company_document_checklist((select company from public.zz_test_m)) where code = 'EJARI_LEASE') then
  raise exception 'FAIL - the lease document must not be asked before the company says it has its own lease';
end if;
insert into company_document (company_id, required_document_id, shareholder_id, file_url)
select (select company from public.zz_test_m), r.required_document_id, r.shareholder_id, 'demo://file'
  from company_document_checklist((select company from public.zz_test_m)) r
 where not r.provided and not r.optional;
insert into company_payment (company_id, reference, package_price_aed, office_price_aed, mao_fee_aed, total_aed)
select company, 'PAY-M1', q.package_price_aed, q.office_price_aed, q.mao_fee_aed, q.total_aed
  from public.zz_test_m, company_quote((select company from public.zz_test_m)) q;
update company_payment set status = 'PAID', paid_at = now() where reference = 'PAY-M1';

-- mainland needs a lease choice before submission
perform public.zz_expect_error('mainland submitted without the Ejari lease choice',
  format($q$update company set status = 'SUBMITTED' where id = %L$q$, (select company from public.zz_test_m)),
  'Ejari lease');

-- MAO provides the lease: office is priced
update company set lease_mode = 'MAO' where id = (select company from public.zz_test_m);
if (select office_price_aed from company_quote((select company from public.zz_test_m))) <> 18000 then
  raise exception 'FAIL - MAO lease: office should be priced 18000';
end if;

-- own lease: no office price, and the lease document becomes mandatory
update company set lease_mode = 'OWN' where id = (select company from public.zz_test_m);
if (select office_price_aed from company_quote((select company from public.zz_test_m))) <> 0 then
  raise exception 'FAIL - own lease: office should cost 0';
end if;
perform public.zz_expect_error('own lease: its document is now mandatory',
  format($q$update company set status = 'SUBMITTED' where id = %L$q$, (select company from public.zz_test_m)),
  'document(s) missing');
insert into company_document (company_id, required_document_id, shareholder_id, file_url)
select (select company from public.zz_test_m), r.required_document_id, r.shareholder_id, 'demo://lease'
  from company_document_checklist((select company from public.zz_test_m)) r
 where r.code = 'EJARI_LEASE' and not r.provided;
delete from company_payment where company_id = (select company from public.zz_test_m);
insert into company_payment (company_id, reference, package_price_aed, office_price_aed, mao_fee_aed, total_aed)
select company, 'PAY-M2', q.package_price_aed, q.office_price_aed, q.mao_fee_aed, q.total_aed
  from public.zz_test_m, company_quote((select company from public.zz_test_m)) q;
update company_payment set status = 'PAID', paid_at = now() where reference = 'PAY-M2';
update company set status = 'SUBMITTED' where id = (select company from public.zz_test_m);
perform public.zz_expect_error('lease mode changed after submission',
  format($q$update company set lease_mode = 'MAO' where id = %L$q$, (select company from public.zz_test_m)),
  'cannot change after submission');


  raise exception 'TESTS OK: % negative checks passed, plus the happy path (everything rolled back)',
    (select count(*) from public.zz_log);
end
$outer$;
