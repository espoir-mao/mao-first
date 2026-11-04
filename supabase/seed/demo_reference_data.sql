-- ===========================================================================
-- DEMO REFERENCE DATA for the company-creation flow.
--
-- *** FICTIONAL VALUES — NOT OFFICIAL TARIFFS. ***
-- Authority names are real, but every price, visa quota, document list and
-- activity list below is invented for the demo and must be replaced by the
-- real, verified catalogue of each guichet before any real use. Rows created
-- here carry "[DÉMO]" in their description so they are easy to recognise.
--
-- Run after migrations 0006 and 0007. Safe to re-run (`on conflict do nothing`
-- / `where not exists`): it never overwrites values edited afterwards.
--
-- V1 scope: 1 mainland guichet (Dubai Department of Economy and Tourism,
-- DET_DXB) and 4 free zones (IFZA, MEYDAN, RAKEZ, SHAMS). Other authorities
-- are listed with is_available = false so they appear as "bientôt".
-- ===========================================================================

-- (the two jurisdictions MAINLAND / FREE_ZONE are created by migration 0006)

-- -------------------------------------------------------------- authorities
insert into public.authority
  (code, jurisdiction_type, name, emirate, tier, is_available, allows_freelance, website)
values
  ('DET_DXB', 'MAINLAND',  'Department of Economy and Tourism (Dubai)', 'Dubaï',     'CORE', true,  false, 'https://www.dubaided.gov.ae'),
  ('IFZA',    'FREE_ZONE', 'IFZA — International Free Zone Authority',  'Dubaï',     'CORE', true,  false, 'https://ifza.com'),
  ('MEYDAN',  'FREE_ZONE', 'Meydan Free Zone',                          'Dubaï',     'CORE', true,  true,  'https://meydanfz.ae'),
  ('RAKEZ',   'FREE_ZONE', 'RAKEZ — Ras Al Khaimah Economic Zone',      'Ras Al Khaimah', 'CORE', true, false, 'https://rakez.com'),
  ('SHAMS',   'FREE_ZONE', 'Sharjah Media City (Shams)',                'Sharjah',   'CORE', true,  true,  'https://shams.ae'),
  -- listed but not offered yet
  ('DMCC',     'FREE_ZONE', 'DMCC',                          'Dubaï',     'SECONDARY', false, false, 'https://www.dmcc.ae'),
  ('DIFC',     'FREE_ZONE', 'DIFC',                          'Dubaï',     'SECONDARY', false, false, 'https://www.difc.ae'),
  ('DAFZA',    'FREE_ZONE', 'Dubai Airport Free Zone',       'Dubaï',     'SECONDARY', false, false, 'https://www.dafz.ae'),
  ('ADGM',     'FREE_ZONE', 'Abu Dhabi Global Market',       'Abou Dhabi','SECONDARY', false, false, 'https://www.adgm.com'),
  ('AJMAN_FZ', 'FREE_ZONE', 'Ajman Free Zone',               'Ajman',     'SECONDARY', false, true,  'https://afza.gov.ae'),
  ('DED_AUH',  'MAINLAND',  'Department of Economic Development (Abou Dhabi)', 'Abou Dhabi', 'SECONDARY', false, false, 'https://www.added.gov.ae')
on conflict (code) do nothing;

-- ------------------------------------------------------------- legal forms
insert into public.legal_form
  (code, jurisdiction_type, label, description, min_shareholders, max_shareholders, in_mao_flow)
values
  ('SOLE_EST', 'MAINLAND',  'Établissement individuel', '[DÉMO] Un seul propriétaire, personne physique.', 1, 1, true),
  ('LLC',      'MAINLAND',  'LLC (société à responsabilité limitée)', '[DÉMO] De 2 à 50 associés.', 2, 50, true),
  ('FZE',      'FREE_ZONE', 'FZE (société d''un seul associé)', '[DÉMO] Un seul actionnaire en zone franche.', 1, 1, true),
  ('FZCO',     'FREE_ZONE', 'FZCO (société multi-associés)', '[DÉMO] De 2 à 50 actionnaires en zone franche.', 2, 50, true),
  ('FREELANCE_PERMIT', 'FREE_ZONE', 'Permis freelance', '[DÉMO] Permis individuel pour travailleur indépendant.', 1, 1, true),
  -- legal forms that exist but are out of the MAO flow in V1
  ('BRANCH',   'FREE_ZONE', 'Succursale', '[DÉMO] Succursale d''une société étrangère (hors parcours V1).', 1, 1, false),
  ('CIVIL',    'MAINLAND',  'Société civile', '[DÉMO] Professions libérales (hors parcours V1).', 1, 10, false)
on conflict (code) do nothing;

-- Client choice -> legal form, per authority.
insert into public.authority_legal_form (authority_id, legal_form_id, client_choice)
select a.id, lf.id, m.client_choice
  from (values
    ('MAINLAND',  'SOLO',      'SOLE_EST'),
    ('MAINLAND',  'MULTI',     'LLC'),
    ('FREE_ZONE', 'SOLO',      'FZE'),
    ('FREE_ZONE', 'MULTI',     'FZCO'),
    ('FREE_ZONE', 'FREELANCE', 'FREELANCE_PERMIT')
  ) as m(jurisdiction_type, client_choice, legal_form_code)
  join public.authority a
    on a.jurisdiction_type = m.jurisdiction_type
   and a.is_available
   and (m.client_choice <> 'FREELANCE' or a.allows_freelance)
  join public.legal_form lf on lf.code = m.legal_form_code
on conflict do nothing;

-- ----------------------------------------------------------- licence types
insert into public.licence_type (code, label, description) values
  ('COMMERCIAL',   'Licence commerciale',   '[DÉMO] Négoce, e-commerce, import/export.'),
  ('PROFESSIONAL', 'Licence de services',   '[DÉMO] Conseil, technologie, marketing et autres services professionnels.'),
  ('INDUSTRIAL',   'Licence industrielle',  '[DÉMO] Fabrication et transformation.')
on conflict (code) do nothing;

-- -------------------------------------------------------------- activities
-- Same demo nomenclature for every available authority. Activities flagged
-- requires_external_approval (health, education, finance) exist in the
-- catalogue but cannot be picked in V1.
insert into public.activity (authority_id, code, label, licence_type_id, requires_external_approval)
select a.id, t.code, t.label, lt.id, t.ext
  from public.authority a
  cross join (values
    ('TRADING_GENERAL',  'Commerce général',                   'COMMERCIAL',   false),
    ('ECOMMERCE',        'Commerce électronique',              'COMMERCIAL',   false),
    ('IMPORT_EXPORT',    'Import / export',                    'COMMERCIAL',   false),
    ('CONSULTING_MGMT',  'Conseil en management',              'PROFESSIONAL', false),
    ('IT_SOFTWARE',      'Développement logiciel',             'PROFESSIONAL', false),
    ('MARKETING',        'Marketing et publicité',             'PROFESSIONAL', false),
    ('ENGINEERING',      'Conseil en ingénierie',              'PROFESSIONAL', false),
    ('ARCHITECTURE',     'Bureau d''études / architecture',    'PROFESSIONAL', false),
    ('LIGHT_MANUFACT',   'Fabrication légère',                 'INDUSTRIAL',   false),
    ('FOOD_PROCESSING',  'Transformation alimentaire',         'INDUSTRIAL',   false),
    ('HEALTHCARE',       'Santé (clinique, cabinet médical)',  'PROFESSIONAL', true),
    ('EDUCATION',        'Éducation et centre de formation',   'PROFESSIONAL', true),
    ('FINANCIAL_SVC',    'Services financiers',                'PROFESSIONAL', true)
  ) as t(code, label, licence_code, ext)
  join public.licence_type lt on lt.code = t.licence_code
 where a.is_available
on conflict (authority_id, code) do nothing;

-- ------------------------------------------------------------- office types
insert into public.office_type (code, label, description, provides_ejari) values
  ('FLEXI_DESK',     'Flexi-desk',        '[DÉMO] Bureau partagé fourni par l''autorité ; pas de bail dédié.', false),
  ('PRIVATE_OFFICE', 'Bureau privé',      '[DÉMO] Bureau privatif dans les locaux de la zone.', false),
  ('EJARI_OFFICE',   'Bureau avec Ejari', '[DÉMO] Bureau loué avec contrat enregistré Ejari (enregistrement officiel du bail à Dubaï) — obligatoire en mainland.', true)
on conflict (code) do nothing;

insert into public.authority_office_option (authority_id, office_type_id, visa_quota_max, annual_price_aed)
select a.id, o.id, m.quota, m.price
  from (values
    ('DET_DXB', 'EJARI_OFFICE',   6, 18000),
    ('IFZA',    'FLEXI_DESK',     2,  3500),
    ('IFZA',    'PRIVATE_OFFICE', 6, 14000),
    ('MEYDAN',  'FLEXI_DESK',     3,  4000),
    ('MEYDAN',  'PRIVATE_OFFICE', 8, 16000),
    ('RAKEZ',   'FLEXI_DESK',     2,  3000),
    ('RAKEZ',   'PRIVATE_OFFICE', 6, 11000),
    ('SHAMS',   'FLEXI_DESK',     2,  2500),
    ('SHAMS',   'PRIVATE_OFFICE', 4,  9000)
  ) as m(authority_code, office_code, quota, price)
  join public.authority a on a.code = m.authority_code
  join public.office_type o on o.code = m.office_code
on conflict do nothing;

-- ---------------------------------------------------------- package prices
-- One price per (authority, legal form, number of visas), from 0 up to the
-- largest quota offered by the authority. Demo formula: base + 3 500 AED per
-- visa.
insert into public.authority_pricing (authority_id, legal_form_id, visa_count, price_aed, valid_from)
select alf.authority_id,
       alf.legal_form_id,
       v.n,
       b.base_aed + 3500 * v.n - case when lf.code = 'FREELANCE_PERMIT' then 4000 else 0 end,
       date '2026-01-01'
  from public.authority_legal_form alf
  join public.authority a on a.id = alf.authority_id
  join public.legal_form lf on lf.id = alf.legal_form_id
  join (values
    ('DET_DXB', 9500), ('IFZA', 12900), ('MEYDAN', 11800), ('RAKEZ', 10400), ('SHAMS', 8900)
  ) as b(authority_code, base_aed) on b.authority_code = a.code
  cross join lateral generate_series(
    0,
    (select max(o.visa_quota_max) from public.authority_office_option o where o.authority_id = alf.authority_id)
  ) as v(n)
on conflict do nothing;

-- --------------------------------------------------------------- MAO fee
insert into public.mao_fee (jurisdiction_type, fee_aed, valid_from)
select j.code, j.fee, date '2026-01-01'
  from (values ('MAINLAND', 2500), ('FREE_ZONE', 1800)) as j(code, fee)
 where not exists (select 1 from public.mao_fee f where f.jurisdiction_type = j.code);

-- ------------------------------------------------------ required documents
-- Common to every available authority and legal form.
insert into public.required_document (authority_id, code, label, applies_to)
select a.id, d.code, d.label, d.applies_to
  from public.authority a
  cross join (values
    ('PASSPORT',          'Passeport en cours de validité',   'SHAREHOLDER'),
    ('PHOTO',             'Photo d''identité récente',        'SHAREHOLDER'),
    ('PROOF_OF_ADDRESS',  'Justificatif de domicile',         'SHAREHOLDER'),
    -- documents of a parent company holding shares (legalised abroad)
    ('PARENT_CERTIFICATE', 'Certificat d''immatriculation de la société mère (légalisé)', 'PARENT_COMPANY'),
    ('PARENT_MOA',         'Statuts de la société mère (légalisés)',                       'PARENT_COMPANY'),
    ('PARENT_RESOLUTION',  'Résolution du conseil de la société mère (légalisée)',         'PARENT_COMPANY')
  ) as d(code, label, applies_to)
 where a.is_available
on conflict do nothing;

-- Mainland only: the manager's Emirates ID copy if already resident.
-- Optional: not everyone has one (0010 adds the is_optional / required_when columns).
insert into public.required_document (authority_id, code, label, applies_to, is_optional)
select a.id, 'MANAGER_RESIDENCE', 'Visa de résidence / Emirates ID du dirigeant (facultatif)', 'MANAGER', true
  from public.authority a
 where a.code = 'DET_DXB'
on conflict do nothing;

-- Mainland: the Ejari lease, requested only when the company brings its own.
insert into public.required_document (authority_id, code, label, applies_to, required_when)
select a.id, 'EJARI_LEASE', 'Contrat de bail enregistré Ejari', 'COMPANY', 'LEASE_OWN'
  from public.authority a
 where a.jurisdiction_type = 'MAINLAND' and a.is_available
on conflict do nothing;

-- Activity-specific: CV and diploma of the manager for regulated professions.
insert into public.required_document (authority_id, activity_id, code, label, applies_to)
select act.authority_id, act.id, d.code, d.label, 'MANAGER'
  from public.activity act
  cross join (values
    ('CV',      'Curriculum vitae du dirigeant'),
    ('DIPLOMA', 'Diplôme du dirigeant (attesté)')
  ) as d(code, label)
 where act.code in ('ENGINEERING', 'ARCHITECTURE')
on conflict do nothing;
