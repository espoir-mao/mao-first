/**
 * Business rules of the company-creation flow, as pure functions.
 *
 * These mirror the guards enforced by the database (supabase/migrations/0006:
 * FK / CHECK / triggers). The database remains the source of truth — this
 * module lets the server actions and the wizard explain a refusal *before*
 * hitting a constraint, and gives the UI the same answers (which structure
 * choices exist, which activities are selectable, what the quote is...).
 *
 * No runtime imports: it is unit-tested with `node --test` (see tests/).
 */
import type {
  Activity,
  Authority,
  AuthorityLegalForm,
  AuthorityOfficeOption,
  AuthorityPricing,
  ClientChoice,
  CompanyStatus,
  JurisdictionType,
  LeaseMode,
  LegalForm,
  LicenceType,
  MaoFee,
  OfficeType,
  RequiredDocument,
} from "./company-types";

export interface Issue {
  /** Stable code, also used as i18n key suffix (`company.issue.<code>`). */
  code: string;
  /** Free values to interpolate in the message. */
  params?: Record<string, string | number>;
}

// ------------------------------------------------------------ 1-3 structure

/** The authorities a client can pick for a jurisdiction (V1: available ones). */
export function selectableAuthorities(
  authorities: Authority[],
  jurisdiction: JurisdictionType
): Authority[] {
  return authorities.filter(
    (a) => a.jurisdiction_type === jurisdiction && a.is_available
  );
}

/** Mainland has no question about clients: free zones suit mostly non-local clients. */
export function suggestJurisdiction(clientsInUae: boolean): JurisdictionType {
  return clientsInUae ? "MAINLAND" : "FREE_ZONE";
}

/** Structure choices (solo / several / freelance) offered by an authority. */
export function availableChoices(
  authority: Authority,
  links: AuthorityLegalForm[],
  legalForms: LegalForm[]
): ClientChoice[] {
  const order: ClientChoice[] = ["SOLO", "MULTI", "FREELANCE"];
  return order.filter((choice) => {
    if (choice === "FREELANCE" && !authority.allows_freelance) return false;
    const link = links.find(
      (l) => l.authority_id === authority.id && l.client_choice === choice
    );
    if (!link) return false;
    const lf = legalForms.find((f) => f.id === link.legal_form_id);
    return Boolean(lf && lf.in_mao_flow);
  });
}

/** Resolves the legal form from (authority, client choice). */
export function resolveLegalForm(
  authorityId: string,
  choice: ClientChoice,
  links: AuthorityLegalForm[],
  legalForms: LegalForm[]
): LegalForm | null {
  const link = links.find(
    (l) => l.authority_id === authorityId && l.client_choice === choice
  );
  if (!link) return null;
  return legalForms.find((f) => f.id === link.legal_form_id) ?? null;
}

// ------------------------------------------------------------ 4 activities

/** Activities of an authority that can be chosen in V1. */
export function selectableActivities(
  activities: Activity[],
  authorityId: string
): Activity[] {
  return activities.filter(
    (a) => a.authority_id === authorityId && !a.requires_external_approval
  );
}

export function blockedActivities(
  activities: Activity[],
  authorityId: string
): Activity[] {
  return activities.filter(
    (a) => a.authority_id === authorityId && a.requires_external_approval
  );
}

export interface ActivityResolution {
  licenceTypeId: string | null;
  issues: Issue[];
}

/**
 * The licence type follows from the chosen activities. One licence covers a
 * single licence type: mixing, say, a trading and a consulting activity is
 * refused (the client must pick activities of the same type).
 */
export function resolveLicenceType(
  chosenIds: string[],
  activities: Activity[],
  authorityId: string,
  licenceTypes: LicenceType[]
): ActivityResolution {
  const issues: Issue[] = [];
  if (chosenIds.length === 0) {
    return { licenceTypeId: null, issues: [{ code: "ACTIVITY_REQUIRED" }] };
  }
  const chosen: Activity[] = [];
  for (const id of chosenIds) {
    const a = activities.find((x) => x.id === id);
    if (!a) {
      issues.push({ code: "ACTIVITY_UNKNOWN" });
      continue;
    }
    if (a.authority_id !== authorityId) {
      issues.push({ code: "ACTIVITY_OTHER_AUTHORITY", params: { activity: a.label } });
    }
    if (a.requires_external_approval) {
      issues.push({ code: "ACTIVITY_EXTERNAL_APPROVAL", params: { activity: a.label } });
    }
    chosen.push(a);
  }
  const types: string[] = [];
  chosen.forEach((a) => {
    if (types.indexOf(a.licence_type_id) === -1) types.push(a.licence_type_id);
  });
  if (types.length > 1) {
    issues.push({
      code: "ACTIVITY_MIXED_LICENCE",
      params: {
        types: types
          .map((id) => licenceTypes.find((l) => l.id === id)?.label ?? id)
          .join(", "),
      },
    });
  }
  return {
    licenceTypeId: issues.length === 0 && types.length === 1 ? types[0] : null,
    issues,
  };
}

// ---------------------------------------------------------- 5 trade name

const RELIGIOUS_TERMS = [
  "allah", "god", "dieu", "jesus", "christ", "prophet", "prophete",
  "quran", "koran", "coran", "bible", "vatican", "makkah", "mecca",
];
const STATE_TERMS = [
  "uae", "emirates", "emirate", "emirati", "government", "gouvernement",
  "ministry", "ministere", "federal", "municipality", "municipalite",
  "sheikh", "cheikh", "royal", "police", "army", "armee", "president",
];
const REGULATED_TERMS = [
  "bank", "banque", "insurance", "assurance", "takaful", "exchange",
  "university", "universite",
];
/** Legal-form words the guichet adds itself: ignored when judging a name. */
const LEGAL_SUFFIXES = ["llc", "fze", "fzco", "fz", "ltd", "limited", "est", "inc"];

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function nameTokens(name: string): string[] {
  return normalizeName(name)
    .split(/[^a-z0-9.]+/)
    .filter((t) => t.length > 0);
}

/** Checks one proposed trade name the way the guichet would. */
export function validateTradeName(raw: string): Issue[] {
  const issues: Issue[] = [];
  const name = (raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 3) issues.push({ code: "NAME_TOO_SHORT" });
  if (name.length > 60) issues.push({ code: "NAME_TOO_LONG" });
  if (name.length === 0) return issues;
  if (!/^[A-Za-z0-9\u00C0-\u024F\u0600-\u06FF &'.,\-()]+$/.test(name)) {
    issues.push({ code: "NAME_INVALID_CHARS" });
  }

  const tokens = nameTokens(name);
  const plain = tokens.map((t) => t.replace(/\./g, ""));
  const significant = tokens.filter(
    (t) => LEGAL_SUFFIXES.indexOf(t.replace(/\./g, "")) === -1
  );

  if (plain.some((t) => RELIGIOUS_TERMS.indexOf(t) !== -1)) {
    issues.push({ code: "NAME_RELIGIOUS" });
  }
  if (plain.some((t) => STATE_TERMS.indexOf(t) !== -1)) {
    issues.push({ code: "NAME_STATE" });
  }
  if (plain.some((t) => REGULATED_TERMS.indexOf(t) !== -1)) {
    issues.push({ code: "NAME_REGULATED_TERM" });
  }

  // only initials ("J. M."), or a lone abbreviated first name ("Moh.")
  const onlyInitials =
    significant.length > 0 &&
    significant.every((t) => t.replace(/\./g, "").length <= 1);
  const loneAbbreviation =
    significant.length === 1 &&
    /\.$/.test(significant[0]) &&
    significant[0].replace(/\./g, "").length <= 4;
  const loneShortWord =
    significant.length === 1 && significant[0].replace(/\./g, "").length <= 2;
  if (onlyInitials || loneAbbreviation || loneShortWord) {
    issues.push({ code: "NAME_ABBREVIATION_ONLY" });
  }
  if (significant.length > 0 && significant.every((t) => /^[0-9.]+$/.test(t))) {
    issues.push({ code: "NAME_DIGITS_ONLY" });
  }
  return issues;
}

/** The three ranked proposals: each valid, all different. */
export function validateNameProposals(names: string[]): Issue[] {
  const issues: Issue[] = [];
  if (names.length !== 3) issues.push({ code: "NAMES_THREE_REQUIRED" });
  const seen: string[] = [];
  names.forEach((n, i) => {
    validateTradeName(n).forEach((issue) =>
      issues.push({ ...issue, params: { ...(issue.params ?? {}), rank: i + 1 } })
    );
    const key = normalizeName(n).replace(/\s+/g, " ").trim();
    if (key && seen.indexOf(key) !== -1) {
      issues.push({ code: "NAMES_DUPLICATE", params: { rank: i + 1 } });
    }
    seen.push(key);
  });
  return issues;
}

// -------------------------------------------------------------- 6 office

export function officeOptionsFor(
  authorityId: string,
  options: AuthorityOfficeOption[],
  officeTypes: OfficeType[]
): { option: AuthorityOfficeOption; type: OfficeType }[] {
  const out: { option: AuthorityOfficeOption; type: OfficeType }[] = [];
  options
    .filter((o) => o.authority_id === authorityId)
    .forEach((option) => {
      const type = officeTypes.find((t) => t.id === option.office_type_id);
      if (type) out.push({ option, type });
    });
  return out;
}

/** Ejari (official lease registration, Dubai) is mandatory for a mainland company. */
export function requiresEjari(jurisdiction: JurisdictionType): boolean {
  return jurisdiction === "MAINLAND";
}

export function validateOffice(
  jurisdiction: JurisdictionType,
  authorityId: string,
  officeTypeId: string,
  visaQuota: number,
  options: AuthorityOfficeOption[],
  officeTypes: OfficeType[]
): Issue[] {
  const issues: Issue[] = [];
  const option = options.find(
    (o) => o.authority_id === authorityId && o.office_type_id === officeTypeId
  );
  const type = officeTypes.find((t) => t.id === officeTypeId);
  if (!option || !type) {
    return [{ code: "OFFICE_NOT_OFFERED" }];
  }
  if (requiresEjari(jurisdiction) && !type.provides_ejari) {
    issues.push({ code: "OFFICE_EJARI_REQUIRED" });
  }
  if (!Number.isInteger(visaQuota) || visaQuota < 0) {
    issues.push({ code: "VISA_QUOTA_INVALID" });
  } else if (visaQuota > option.visa_quota_max) {
    issues.push({
      code: "VISA_QUOTA_TOO_HIGH",
      params: { max: option.visa_quota_max },
    });
  }
  return issues;
}

// ------------------------------------------------------- 7 shareholders

export interface ShareholderInput {
  isPerson: boolean;
  sharePct: number;
  isManager: boolean;
}

export function validateShareholders(
  choice: ClientChoice,
  legalForm: LegalForm,
  holders: ShareholderInput[]
): Issue[] {
  const issues: Issue[] = [];
  const n = holders.length;
  if (n < legalForm.min_shareholders) {
    issues.push({
      code: "SHAREHOLDERS_TOO_FEW",
      params: { min: legalForm.min_shareholders },
    });
  }
  if (legalForm.max_shareholders !== null && n > legalForm.max_shareholders) {
    issues.push({
      code: "SHAREHOLDERS_TOO_MANY",
      params: { max: legalForm.max_shareholders },
    });
  }
  if (choice === "MULTI" && n < 2) issues.push({ code: "SHAREHOLDERS_MULTI_NEEDS_TWO" });
  if (choice !== "MULTI" && n !== 1) issues.push({ code: "SHAREHOLDERS_ONE_ONLY" });

  const total = Math.round(holders.reduce((s, h) => s + h.sharePct, 0) * 100) / 100;
  if (total !== 100) issues.push({ code: "SHARES_NOT_100", params: { total } });
  if (holders.some((h) => h.sharePct <= 0)) issues.push({ code: "SHARE_NOT_POSITIVE" });

  const managers = holders.filter((h) => h.isManager);
  if (managers.length !== 1) {
    issues.push({ code: "MANAGER_EXACTLY_ONE", params: { count: managers.length } });
  } else if (!managers[0].isPerson) {
    issues.push({ code: "MANAGER_MUST_BE_PERSON" });
  }
  return issues;
}

// ---------------------------------------------------------- 8 documents

export interface ChecklistHolder {
  id: string;
  isPerson: boolean;
  isManager: boolean;
  isParentCompany: boolean;
}

export interface ChecklistItem {
  required_document_id: string;
  code: string;
  label: string;
  applies_to: RequiredDocument["applies_to"];
  shareholder_id: string | null;
  provided: boolean;
  optional: boolean;
}

/** Same logic as the SQL function `company_document_checklist`. */
export function documentChecklist(
  authorityId: string,
  legalFormId: string,
  activityIds: string[],
  required: RequiredDocument[],
  holders: ChecklistHolder[],
  uploaded: { required_document_id: string; shareholder_id: string | null; status: string }[],
  leaseMode: LeaseMode | null = null
): ChecklistItem[] {
  const rds = required.filter(
    (r) =>
      r.authority_id === authorityId &&
      (!r.required_when || (r.required_when === "LEASE_OWN" && leaseMode === "OWN")) &&
      (r.legal_form_id === null || r.legal_form_id === legalFormId) &&
      (r.activity_id === null || activityIds.indexOf(r.activity_id) !== -1)
  );
  const items: ChecklistItem[] = [];
  const push = (r: RequiredDocument, sid: string | null) =>
    items.push({
      required_document_id: r.id,
      code: r.code,
      label: r.label,
      applies_to: r.applies_to,
      shareholder_id: sid,
      optional: Boolean(r.is_optional),
      provided: uploaded.some(
        (d) =>
          d.required_document_id === r.id &&
          d.shareholder_id === sid &&
          (d.status === "UPLOADED" || d.status === "VALIDATED")
      ),
    });
  rds.forEach((r) => {
    if (r.applies_to === "COMPANY") push(r, null);
    holders.forEach((h) => {
      if (r.applies_to === "SHAREHOLDER" && h.isPerson) push(r, h.id);
      if (r.applies_to === "MANAGER" && h.isManager) push(r, h.id);
      if (r.applies_to === "PARENT_COMPANY" && h.isParentCompany) push(r, h.id);
    });
  });
  return items;
}

// ------------------------------------------------------------- 9 payment

export interface Quote {
  packageAed: number;
  officeAed: number;
  maoFeeAed: number;
  totalAed: number;
}

function inPeriod(
  today: string,
  from: string,
  to: string | null
): boolean {
  return from <= today && (to === null || to >= today);
}

/** Authority package + yearly office + MAO fee. Null when no price applies. */
export function computeQuote(args: {
  authorityId: string;
  legalFormId: string;
  officeTypeId: string;
  jurisdiction: JurisdictionType;
  visaQuota: number;
  leaseMode?: LeaseMode | null;
  pricing: AuthorityPricing[];
  officeOptions: AuthorityOfficeOption[];
  maoFees: MaoFee[];
  today: string; // YYYY-MM-DD
}): Quote | null {
  const pkg = args.pricing
    .filter(
      (p) =>
        p.authority_id === args.authorityId &&
        p.legal_form_id === args.legalFormId &&
        p.visa_count === args.visaQuota &&
        inPeriod(args.today, p.valid_from, p.valid_to)
    )
    .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0];
  const office = args.officeOptions.find(
    (o) => o.authority_id === args.authorityId && o.office_type_id === args.officeTypeId
  );
  if (!pkg || !office) return null;
  const fee = args.maoFees
    .filter(
      (f) =>
        f.jurisdiction_type === args.jurisdiction &&
        inPeriod(args.today, f.valid_from, f.valid_to)
    )
    .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0];
  const maoFeeAed = fee ? fee.fee_aed : 0;
  // The company brings its own registered lease: no office to pay through MAO.
  const officeAed =
    args.jurisdiction === "MAINLAND" && args.leaseMode === "OWN" ? 0 : office.annual_price_aed;
  return {
    packageAed: pkg.price_aed,
    officeAed,
    maoFeeAed,
    totalAed: pkg.price_aed + officeAed + maoFeeAed,
  };
}

// ------------------------------------------------------ 10 status machine

const TRANSITIONS: Record<CompanyStatus, CompanyStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["NAME_APPROVED", "NAME_REJECTED", "REJECTED"],
  NAME_REJECTED: ["IN_REVIEW", "REJECTED"],
  NAME_APPROVED: ["INITIAL_APPROVAL", "REJECTED"],
  INITIAL_APPROVAL: ["LICENCE_ISSUED", "REJECTED"],
  LICENCE_ISSUED: [],
  REJECTED: [],
};

export function nextStatuses(status: CompanyStatus): CompanyStatus[] {
  return TRANSITIONS[status];
}

export function canTransition(from: CompanyStatus, to: CompanyStatus): boolean {
  return TRANSITIONS[from].indexOf(to) !== -1;
}

/** The five steps shown on the follow-up page, and where a status sits. */
export const TRACKING_STEPS = [
  "SUBMITTED",
  "IN_REVIEW",
  "NAME_APPROVED",
  "INITIAL_APPROVAL",
  "LICENCE_ISSUED",
] as const;

export function trackingProgress(status: CompanyStatus): {
  /** Index in TRACKING_STEPS of the last reached step, -1 before submission. */
  reached: number;
  nameRejected: boolean;
  rejected: boolean;
} {
  if (status === "DRAFT") return { reached: -1, nameRejected: false, rejected: false };
  if (status === "REJECTED") return { reached: -1, nameRejected: false, rejected: true };
  if (status === "NAME_REJECTED") {
    return { reached: 1, nameRejected: true, rejected: false };
  }
  return {
    reached: TRACKING_STEPS.indexOf(status as (typeof TRACKING_STEPS)[number]),
    nameRejected: false,
    rejected: false,
  };
}

// ------------------------------------------------------- full submission

export interface SubmissionSnapshot {
  jurisdiction: JurisdictionType | null;
  authorityId: string | null;
  legalFormId: string | null;
  clientChoice: ClientChoice | null;
  officeTypeId: string | null;
  visaQuota: number | null;
  activityIds: string[];
  names: string[];
  holders: ShareholderInput[];
  leaseMode: LeaseMode | null;
  missingDocuments: number;
  paymentPaid: boolean;
}

/** Everything that stops a file from being submitted (mirrors company_guard). */
export function submissionIssues(
  s: SubmissionSnapshot,
  catalog: {
    legalForms: LegalForm[];
    links: AuthorityLegalForm[];
    activities: Activity[];
    licenceTypes: LicenceType[];
    officeOptions: AuthorityOfficeOption[];
    officeTypes: OfficeType[];
  }
): Issue[] {
  const issues: Issue[] = [];
  if (!s.jurisdiction) return [{ code: "STEP_JURISDICTION" }];
  if (!s.authorityId) return [{ code: "STEP_AUTHORITY" }];
  if (!s.clientChoice) return [{ code: "STEP_STRUCTURE" }];
  const lf = resolveLegalForm(s.authorityId, s.clientChoice, catalog.links, catalog.legalForms);
  if (!lf) return [{ code: "STEP_STRUCTURE" }];

  issues.push(
    ...resolveLicenceType(s.activityIds, catalog.activities, s.authorityId, catalog.licenceTypes).issues
  );
  issues.push(...validateNameProposals(s.names));
  if (!s.officeTypeId || s.visaQuota === null) {
    issues.push({ code: "STEP_OFFICE" });
  } else {
    issues.push(
      ...validateOffice(
        s.jurisdiction,
        s.authorityId,
        s.officeTypeId,
        s.visaQuota,
        catalog.officeOptions,
        catalog.officeTypes
      )
    );
  }
  issues.push(...validateShareholders(s.clientChoice, lf, s.holders));
  if (requiresEjari(s.jurisdiction) && !s.leaseMode) issues.push({ code: "LEASE_REQUIRED" });
  if (s.missingDocuments > 0) {
    issues.push({ code: "DOCUMENTS_MISSING", params: { count: s.missingDocuments } });
  }
  if (!s.paymentPaid) issues.push({ code: "PAYMENT_NOT_PAID" });
  return issues;
}

/**
 * What stops the MAO team from approving the name: the identity check (KYC) is
 * part of their review, not of the client's flow (mirrors company_review_gate).
 */
export function nameApprovalIssues(
  holders: { isPerson: boolean; sharePct: number; isManager: boolean; kycVerified: boolean }[]
): Issue[] {
  return holders.some((h) => h.isPerson && (h.sharePct > 0 || h.isManager) && !h.kycVerified)
    ? [{ code: "KYC_NOT_VERIFIED" }]
    : [];
}

// ------------------------------------------------------------ generators

function dateStamp(now: Date): string {
  return (
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0")
  );
}

function randomCode(n: number): string {
  return Math.random().toString(36).slice(2, 2 + n).toUpperCase().padEnd(n, "0");
}

/** e.g. "SOC-20261007-AB12CD" (same format as the legacy references). */
export function generateTrackingReference(now = new Date()): string {
  return `SOC-${dateStamp(now)}-${randomCode(6)}`;
}

/** e.g. "PAY-20261007-AB12CD" — simulated payment reference. */
export function generatePaymentReference(now = new Date()): string {
  return `PAY-${dateStamp(now)}-${randomCode(6)}`;
}

/** e.g. "LIC-IFZA-AB12CD" — demo licence number. */
export function generateLicenceNumber(authorityCode: string): string {
  return `LIC-${authorityCode.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6)}-${randomCode(6)}`;
}

/** Licences are valid one year. */
export function computeLicenceExpiry(issuedAt: Date): string {
  const d = new Date(issuedAt.getTime());
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}
