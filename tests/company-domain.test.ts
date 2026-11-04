import { test } from "node:test";
import assert from "node:assert/strict";
import * as d from "../lib/company-domain.ts";

const auth = (o = {}) => ({
  id: "a1", code: "IFZA", jurisdiction_type: "FREE_ZONE", name: "IFZA", emirate: "Dubaï",
  tier: "CORE", is_available: true, allows_freelance: false, website: null, ...o,
}) as any;
const lfs = [
  { id: "l1", code: "FZE", jurisdiction_type: "FREE_ZONE", label: "FZE", description: "", min_shareholders: 1, max_shareholders: 1, in_mao_flow: true },
  { id: "l2", code: "FZCO", jurisdiction_type: "FREE_ZONE", label: "FZCO", description: "", min_shareholders: 2, max_shareholders: 50, in_mao_flow: true },
  { id: "l3", code: "FREE", jurisdiction_type: "FREE_ZONE", label: "FREE", description: "", min_shareholders: 1, max_shareholders: 1, in_mao_flow: true },
  { id: "l4", code: "BRANCH", jurisdiction_type: "FREE_ZONE", label: "B", description: "", min_shareholders: 1, max_shareholders: 1, in_mao_flow: false },
] as any[];
const links = [
  { authority_id: "a1", legal_form_id: "l1", client_choice: "SOLO" },
  { authority_id: "a1", legal_form_id: "l2", client_choice: "MULTI" },
  { authority_id: "a1", legal_form_id: "l3", client_choice: "FREELANCE" },
] as any[];

test("jurisdiction suggestion", () => {
  assert.equal(d.suggestJurisdiction(true), "MAINLAND");
  assert.equal(d.suggestJurisdiction(false), "FREE_ZONE");
});

test("structure choices follow the authority", () => {
  assert.deepEqual(d.availableChoices(auth(), links, lfs), ["SOLO", "MULTI"]);
  assert.deepEqual(d.availableChoices(auth({ allows_freelance: true }), links, lfs), ["SOLO", "MULTI", "FREELANCE"]);
  assert.equal(d.resolveLegalForm("a1", "MULTI", links, lfs)?.code, "FZCO");
  assert.equal(d.resolveLegalForm("a2", "MULTI", links, lfs), null);
});

const acts = [
  { id: "x1", authority_id: "a1", code: "IT", label: "IT", licence_type_id: "p", requires_external_approval: false },
  { id: "x2", authority_id: "a1", code: "MKT", label: "MKT", licence_type_id: "p", requires_external_approval: false },
  { id: "x3", authority_id: "a1", code: "TRD", label: "TRD", licence_type_id: "c", requires_external_approval: false },
  { id: "x4", authority_id: "a1", code: "HEALTH", label: "Health", licence_type_id: "p", requires_external_approval: true },
  { id: "x5", authority_id: "a2", code: "IT", label: "IT2", licence_type_id: "p", requires_external_approval: false },
] as any[];
const lts = [{ id: "p", label: "Services" }, { id: "c", label: "Commerciale" }] as any[];

test("activities: selectable list and licence type resolution", () => {
  assert.deepEqual(d.selectableActivities(acts, "a1").map((a) => a.code), ["IT", "MKT", "TRD"]);
  assert.deepEqual(d.blockedActivities(acts, "a1").map((a) => a.code), ["HEALTH"]);
  assert.equal(d.resolveLicenceType(["x1", "x2"], acts, "a1", lts).licenceTypeId, "p");
  const mixed = d.resolveLicenceType(["x1", "x3"], acts, "a1", lts);
  assert.equal(mixed.licenceTypeId, null);
  assert.equal(mixed.issues[0].code, "ACTIVITY_MIXED_LICENCE");
  assert.equal(d.resolveLicenceType(["x4"], acts, "a1", lts).issues[0].code, "ACTIVITY_EXTERNAL_APPROVAL");
  assert.equal(d.resolveLicenceType(["x5"], acts, "a1", lts).issues[0].code, "ACTIVITY_OTHER_AUTHORITY");
  assert.equal(d.resolveLicenceType([], acts, "a1", lts).issues[0].code, "ACTIVITY_REQUIRED");
});

const codes = (n: string) => d.validateTradeName(n).map((i) => i.code);

test("trade name rules", () => {
  assert.deepEqual(codes("Nova Labs"), []);
  assert.deepEqual(codes("Nova Labs LLC"), []);
  assert.ok(codes("Allah Trading").includes("NAME_RELIGIOUS"));
  assert.ok(codes("God's Gift Co").includes("NAME_RELIGIOUS"));
  assert.ok(codes("Dieu Merci").includes("NAME_RELIGIOUS"));
  assert.ok(codes("UAE Best Trading").includes("NAME_STATE"));
  assert.ok(codes("Dubai Government Services").includes("NAME_STATE"));
  assert.ok(codes("Ministère du Commerce").includes("NAME_STATE"));
  assert.ok(codes("J. M.").includes("NAME_ABBREVIATION_ONLY"));
  assert.ok(codes("Moh.").includes("NAME_ABBREVIATION_ONLY"));
  assert.ok(codes("AB").includes("NAME_ABBREVIATION_ONLY"));
  assert.ok(codes("AB LLC").includes("NAME_ABBREVIATION_ONLY"));
  assert.ok(codes("Gulf Bank Advisory").includes("NAME_REGULATED_TERM"));
  assert.ok(codes("Hi").includes("NAME_TOO_SHORT"));
  assert.ok(codes("x".repeat(61)).includes("NAME_TOO_LONG"));
  assert.ok(codes("Nova <script>").includes("NAME_INVALID_CHARS"));
  assert.ok(codes("1234").includes("NAME_DIGITS_ONLY"));
  assert.deepEqual(codes("Godfrey Partners"), []); // "god" only as a whole word
});

test("three proposals must be distinct", () => {
  assert.deepEqual(d.validateNameProposals(["Nova Labs", "Nova Studio", "Nova Works"]), []);
  const dup = d.validateNameProposals(["Nova Labs", "nova  labs", "Nova Works"]);
  assert.equal(dup[0].code, "NAMES_DUPLICATE");
  assert.equal(d.validateNameProposals(["A Name"]).some((i) => i.code === "NAMES_THREE_REQUIRED"), true);
});

const types = [
  { id: "o1", code: "FLEXI", provides_ejari: false },
  { id: "o2", code: "EJARI", provides_ejari: true },
] as any[];
const opts = [
  { authority_id: "a1", office_type_id: "o1", visa_quota_max: 2, annual_price_aed: 1000 },
  { authority_id: "a1", office_type_id: "o2", visa_quota_max: 6, annual_price_aed: 5000 },
] as any[];

test("office, Ejari and visa quota", () => {
  assert.deepEqual(d.validateOffice("FREE_ZONE", "a1", "o1", 2, opts, types), []);
  assert.equal(d.validateOffice("FREE_ZONE", "a1", "o1", 3, opts, types)[0].code, "VISA_QUOTA_TOO_HIGH");
  assert.equal(d.validateOffice("MAINLAND", "a1", "o1", 1, opts, types)[0].code, "OFFICE_EJARI_REQUIRED");
  assert.deepEqual(d.validateOffice("MAINLAND", "a1", "o2", 6, opts, types), []);
  assert.equal(d.validateOffice("FREE_ZONE", "a1", "o9", 1, opts, types)[0].code, "OFFICE_NOT_OFFERED");
  assert.equal(d.validateOffice("FREE_ZONE", "a1", "o1", -1, opts, types)[0].code, "VISA_QUOTA_INVALID");
});

test("shareholders", () => {
  const person = (p: number, m = false) => ({ isPerson: true, sharePct: p, isManager: m });
  assert.deepEqual(d.validateShareholders("SOLO", lfs[0], [person(100, true)]), []);
  assert.deepEqual(d.validateShareholders("MULTI", lfs[1], [person(60, true), person(40)]), []);
  const codesOf = (c: any, lf: any, h: any) => d.validateShareholders(c, lf, h).map((i) => i.code);
  assert.ok(codesOf("MULTI", lfs[1], [person(100, true)]).includes("SHAREHOLDERS_TOO_FEW"));
  assert.ok(codesOf("SOLO", lfs[0], [person(50, true), person(50)]).includes("SHAREHOLDERS_TOO_MANY"));
  assert.ok(codesOf("MULTI", lfs[1], [person(60, true), person(30)]).includes("SHARES_NOT_100"));
  assert.ok(codesOf("MULTI", lfs[1], [person(50), person(50)]).includes("MANAGER_EXACTLY_ONE"));
  assert.ok(codesOf("MULTI", lfs[1], [person(50, true), person(50, true)]).includes("MANAGER_EXACTLY_ONE"));
  assert.ok(
    codesOf("MULTI", lfs[1], [{ isPerson: false, sharePct: 50, isManager: true }, person(50)]).includes("MANAGER_MUST_BE_PERSON")
  );
  // 33.33 + 33.33 + 33.34 adds up to exactly 100
  assert.deepEqual(d.validateShareholders("MULTI", lfs[1], [person(33.33, true), person(33.33), person(33.34)]), []);
});

test("document checklist", () => {
  const rds = [
    { id: "r1", authority_id: "a1", legal_form_id: null, activity_id: null, code: "PASSPORT", label: "", applies_to: "SHAREHOLDER" },
    { id: "r2", authority_id: "a1", legal_form_id: null, activity_id: "x1", code: "CV", label: "", applies_to: "MANAGER" },
    { id: "r3", authority_id: "a1", legal_form_id: null, activity_id: null, code: "MOA", label: "", applies_to: "PARENT_COMPANY" },
    { id: "r4", authority_id: "a2", legal_form_id: null, activity_id: null, code: "OTHER", label: "", applies_to: "COMPANY" },
  ] as any[];
  const holders = [
    { id: "s1", isPerson: true, isManager: true, isParentCompany: false },
    { id: "s2", isPerson: false, isManager: false, isParentCompany: true },
  ];
  const upl = [{ required_document_id: "r1", shareholder_id: "s1", status: "UPLOADED" }];
  const list = d.documentChecklist("a1", "l2", ["x1"], rds, holders, upl);
  assert.deepEqual(list.map((i) => `${i.code}:${i.shareholder_id}:${i.provided}`), [
    "PASSPORT:s1:true", "CV:s1:false", "MOA:s2:false",
  ]);
  assert.equal(d.documentChecklist("a1", "l2", ["x2"], rds, holders, upl).some((i) => i.code === "CV"), false);
});

test("quote", () => {
  const pricing = [
    { authority_id: "a1", legal_form_id: "l1", visa_count: 1, price_aed: 10000, valid_from: "2026-01-01", valid_to: "2026-06-30" },
    { authority_id: "a1", legal_form_id: "l1", visa_count: 1, price_aed: 12000, valid_from: "2026-07-01", valid_to: null },
  ] as any[];
  const fees = [{ jurisdiction_type: "FREE_ZONE", fee_aed: 1800, valid_from: "2026-01-01", valid_to: null }] as any[];
  const base = { authorityId: "a1", legalFormId: "l1", officeTypeId: "o1", jurisdiction: "FREE_ZONE" as const, visaQuota: 1, pricing, officeOptions: opts, maoFees: fees };
  assert.deepEqual(d.computeQuote({ ...base, today: "2026-10-13" }), { packageAed: 12000, officeAed: 1000, maoFeeAed: 1800, totalAed: 14800 });
  assert.equal(d.computeQuote({ ...base, today: "2026-03-01" })?.packageAed, 10000);
  assert.equal(d.computeQuote({ ...base, visaQuota: 2, today: "2026-10-13" }), null);
  assert.equal(d.computeQuote({ ...base, today: "2025-01-01" }), null);
});

test("status machine and tracking", () => {
  assert.equal(d.canTransition("DRAFT", "SUBMITTED"), true);
  assert.equal(d.canTransition("DRAFT", "LICENCE_ISSUED"), false);
  assert.equal(d.canTransition("LICENCE_ISSUED", "REJECTED"), false);
  assert.deepEqual(d.nextStatuses("IN_REVIEW"), ["NAME_APPROVED", "NAME_REJECTED", "REJECTED"]);
  assert.deepEqual(d.trackingProgress("DRAFT"), { reached: -1, nameRejected: false, rejected: false });
  assert.deepEqual(d.trackingProgress("NAME_APPROVED"), { reached: 2, nameRejected: false, rejected: false });
  assert.deepEqual(d.trackingProgress("NAME_REJECTED"), { reached: 1, nameRejected: true, rejected: false });
  assert.equal(d.trackingProgress("REJECTED").rejected, true);
});

test("submission issues aggregate every rule", () => {
  const cat = { legalForms: lfs, links, activities: acts, licenceTypes: lts, officeOptions: opts, officeTypes: types };
  const ok = {
    jurisdiction: "FREE_ZONE" as const, authorityId: "a1", legalFormId: "l1", clientChoice: "SOLO" as const,
    officeTypeId: "o1", visaQuota: 1, activityIds: ["x1"], names: ["Nova Labs", "Nova Studio", "Nova Works"],
    holders: [{ isPerson: true, sharePct: 100, isManager: true }],
    leaseMode: null, missingDocuments: 0, paymentPaid: true,
  };
  assert.deepEqual(d.submissionIssues(ok, cat), []);
  const bad = d.submissionIssues({ ...ok, missingDocuments: 2, paymentPaid: false }, cat).map((i) => i.code);
  assert.deepEqual(bad, ["DOCUMENTS_MISSING", "PAYMENT_NOT_PAID"]);
  assert.equal(d.submissionIssues({ ...ok, authorityId: null }, cat)[0].code, "STEP_AUTHORITY");
});

test("generators", () => {
  assert.match(d.generateTrackingReference(), /^SOC-\d{8}-[A-Z0-9]{6}$/);
  assert.match(d.generatePaymentReference(), /^PAY-\d{8}-[A-Z0-9]{6}$/);
  assert.match(d.generateLicenceNumber("det_dxb"), /^LIC-DETDXB-[A-Z0-9]{6}$/);
  assert.equal(d.computeLicenceExpiry(new Date("2026-10-13T00:00:00Z")).slice(0, 10), "2027-10-13");
});

import { firstIncompleteStep } from "../lib/company-wizard.ts";

test("a resumed draft opens on its first incomplete screen", () => {
  const base: any = {
    status: "DRAFT", jurisdiction_type: null, authority_id: null, client_choice: null, legal_form_id: null,
    activity_ids: [], licence_type_id: null, names: [], office_type_id: null, visa_quota: null,
    shareholders: [], documents: [],
  };
  const cat = { requiredDocuments: [] as any[] };
  assert.equal(firstIncompleteStep(base, cat), 0);
  const withJ = { ...base, jurisdiction_type: "FREE_ZONE" };
  assert.equal(firstIncompleteStep(withJ, cat), 1);
  const withA = { ...withJ, authority_id: "a1" };
  assert.equal(firstIncompleteStep(withA, cat), 2);
  const withS = { ...withA, client_choice: "SOLO", legal_form_id: "l1" };
  assert.equal(firstIncompleteStep(withS, cat), 3);
  const withAct = { ...withS, activity_ids: ["x1"], licence_type_id: "p" };
  assert.equal(firstIncompleteStep(withAct, cat), 4);
  const withN = { ...withAct, names: [1, 2, 3].map((r) => ({ rank: r })) };
  assert.equal(firstIncompleteStep(withN, cat), 5);
  const withO = { ...withN, office_type_id: "o1", visa_quota: 1 };
  assert.equal(firstIncompleteStep(withO, cat), 6);
  const withH = { ...withO, shareholders: [{ id: "s1", person_id: "p1", parent_company_id: null, is_manager: true, share_pct: 100, kyc_status: "VERIFIED" }] };
  assert.equal(firstIncompleteStep(withH, cat), 8); // recap
  const docCat = { requiredDocuments: [{ id: "r1", authority_id: "a1", legal_form_id: null, activity_id: null, code: "PASSPORT", label: "", applies_to: "SHAREHOLDER" }] as any[] };
  assert.equal(firstIncompleteStep(withH, docCat), 7);
  assert.equal(firstIncompleteStep({ ...withH, status: "SUBMITTED" }, docCat), 10);
  // mainland: the documents screen stays open until the lease choice is made
  const mainland = { ...withH, jurisdiction_type: "MAINLAND", lease_mode: null };
  assert.equal(firstIncompleteStep(mainland, cat), 7);
  assert.equal(firstIncompleteStep({ ...mainland, lease_mode: "MAO" }, cat), 8);
  // KYC is no longer a creation step: an unverified holder still passes step 7
  assert.equal(firstIncompleteStep({ ...withO, shareholders: [{ ...withH.shareholders[0], kyc_status: "NOT_STARTED" }] }, cat) > 6, true);
});

test("name approval needs every person KYC-verified (review rule)", () => {
  assert.deepEqual(d.nameApprovalIssues([{ isPerson: true, sharePct: 100, isManager: true, kycVerified: false }]).map((i) => i.code), ["KYC_NOT_VERIFIED"]);
  assert.deepEqual(d.nameApprovalIssues([{ isPerson: true, sharePct: 100, isManager: true, kycVerified: true }]), []);
  assert.deepEqual(d.nameApprovalIssues([{ isPerson: false, sharePct: 100, isManager: false, kycVerified: false }]), []);
});

test("optional documents and the Ejari lease", () => {
  const rds = [
    { id: "r1", authority_id: "a1", legal_form_id: null, activity_id: null, code: "PASSPORT", label: "", applies_to: "SHAREHOLDER", is_optional: false, required_when: null },
    { id: "r2", authority_id: "a1", legal_form_id: null, activity_id: null, code: "MANAGER_RESIDENCE", label: "", applies_to: "MANAGER", is_optional: true, required_when: null },
    { id: "r3", authority_id: "a1", legal_form_id: null, activity_id: null, code: "EJARI_LEASE", label: "", applies_to: "COMPANY", is_optional: false, required_when: "LEASE_OWN" },
  ] as any[];
  const holders = [{ id: "s1", isPerson: true, isManager: true, isParentCompany: false }];
  const codes = (lease: any) => d.documentChecklist("a1", "l1", [], rds, holders, [], lease).map((i) => i.code);
  assert.deepEqual(codes(null), ["PASSPORT", "MANAGER_RESIDENCE"]);
  assert.deepEqual(codes("MAO"), ["PASSPORT", "MANAGER_RESIDENCE"]);
  assert.deepEqual(codes("OWN"), ["PASSPORT", "MANAGER_RESIDENCE", "EJARI_LEASE"]);
  const residence = d.documentChecklist("a1", "l1", [], rds, holders, []).find((i) => i.code === "MANAGER_RESIDENCE");
  assert.equal(residence?.optional, true);
  assert.equal(residence?.provided, false);
});

test("own lease: no office price; mainland must choose who provides the lease", () => {
  const pricing = [{ authority_id: "a1", legal_form_id: "l1", visa_count: 1, price_aed: 10000, valid_from: "2026-01-01", valid_to: null }] as any[];
  const fees = [{ jurisdiction_type: "MAINLAND", fee_aed: 2500, valid_from: "2026-01-01", valid_to: null }] as any[];
  const offices = [{ authority_id: "a1", office_type_id: "o1", visa_quota_max: 2, annual_price_aed: 18000 }] as any[];
  const base = { authorityId: "a1", legalFormId: "l1", officeTypeId: "o1", jurisdiction: "MAINLAND" as const, visaQuota: 1, pricing, officeOptions: offices, maoFees: fees, today: "2026-10-13" };
  assert.equal(d.computeQuote({ ...base, leaseMode: "MAO" })?.officeAed, 18000);
  assert.deepEqual(d.computeQuote({ ...base, leaseMode: "OWN" }), { packageAed: 10000, officeAed: 0, maoFeeAed: 2500, totalAed: 12500 });
  const cat = { legalForms: lfs, links, activities: acts, licenceTypes: lts, officeOptions: opts, officeTypes: types };
  const snap = {
    jurisdiction: "MAINLAND" as const, authorityId: "a1", legalFormId: "l1", clientChoice: "SOLO" as const,
    officeTypeId: "o1", visaQuota: 1, activityIds: ["x1"], names: ["Nova Labs", "Nova Studio", "Nova Works"],
    holders: [{ isPerson: true, sharePct: 100, isManager: true }],
    leaseMode: null, missingDocuments: 0, paymentPaid: true,
  };
  const codes = (x: any) => d.submissionIssues(x, cat).map((i) => i.code);
  assert.equal(codes(snap).includes("LEASE_REQUIRED"), true);
  assert.equal(codes({ ...snap, leaseMode: "OWN" }).includes("LEASE_REQUIRED"), false);
  assert.equal(codes({ ...snap, jurisdiction: "FREE_ZONE" }).includes("LEASE_REQUIRED"), false);
});
