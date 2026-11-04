/**
 * Types of the company-creation model (see supabase/migrations/0006 and 0007).
 * `company` replaces the legacy `societes` table.
 */

export type JurisdictionType = "MAINLAND" | "FREE_ZONE";
export type ClientChoice = "SOLO" | "MULTI" | "FREELANCE";
export type AuthorityTier = "CORE" | "SECONDARY";
export type DocumentAppliesTo =
  | "COMPANY"
  | "SHAREHOLDER"
  | "MANAGER"
  | "PARENT_COMPANY";

export interface Authority {
  id: string;
  code: string;
  jurisdiction_type: JurisdictionType;
  name: string;
  emirate: string;
  tier: AuthorityTier;
  is_available: boolean;
  allows_freelance: boolean;
  website: string | null;
}

export interface LegalForm {
  id: string;
  code: string;
  jurisdiction_type: JurisdictionType;
  label: string;
  description: string;
  min_shareholders: number;
  max_shareholders: number | null;
  in_mao_flow: boolean;
}

export interface AuthorityLegalForm {
  authority_id: string;
  legal_form_id: string;
  client_choice: ClientChoice;
}

export interface LicenceType {
  id: string;
  code: string;
  label: string;
  description: string;
}

export interface Activity {
  id: string;
  authority_id: string;
  code: string;
  label: string;
  licence_type_id: string;
  requires_external_approval: boolean;
}

export interface OfficeType {
  id: string;
  code: string;
  label: string;
  description: string;
  provides_ejari: boolean;
}

export interface AuthorityOfficeOption {
  authority_id: string;
  office_type_id: string;
  visa_quota_max: number;
  annual_price_aed: number;
}

export interface AuthorityPricing {
  authority_id: string;
  legal_form_id: string;
  visa_count: number;
  price_aed: number;
  valid_from: string;
  valid_to: string | null;
}

export interface RequiredDocument {
  id: string;
  authority_id: string;
  legal_form_id: string | null;
  activity_id: string | null;
  code: string;
  label: string;
  applies_to: DocumentAppliesTo;
  is_optional: boolean;
  required_when: "LEASE_OWN" | null;
}

export type LeaseMode = "OWN" | "MAO";

export interface MaoFee {
  jurisdiction_type: JurisdictionType;
  fee_aed: number;
  valid_from: string;
  valid_to: string | null;
}

/** Everything the wizard needs once a jurisdiction is chosen. */
export interface CompanyCatalog {
  authorities: Authority[];
  legalForms: LegalForm[];
  authorityLegalForms: AuthorityLegalForm[];
  licenceTypes: LicenceType[];
  activities: Activity[];
  officeTypes: OfficeType[];
  officeOptions: AuthorityOfficeOption[];
  pricing: AuthorityPricing[];
  requiredDocuments: RequiredDocument[];
  maoFees: MaoFee[];
}

export type CompanyStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "NAME_REJECTED"
  | "NAME_APPROVED"
  | "INITIAL_APPROVAL"
  | "LICENCE_ISSUED"
  | "REJECTED";

export type KycStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "NOT_APPLICABLE";

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  passport_number: string | null;
  birth_date: string | null;
}

export interface ParentCompany {
  id: string;
  name: string;
  country: string | null;
  registration_number: string | null;
}

export interface Shareholder {
  id: string;
  company_id: string;
  person_id: string | null;
  parent_company_id: string | null;
  share_pct: number;
  is_manager: boolean;
  kyc_status: KycStatus;
  kyc_reference: string | null;
  kyc_checked_at: string | null;
  person?: Person | null;
  parent_company?: ParentCompany | null;
}

export type NameRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CompanyNameRequest {
  id: string;
  company_id: string;
  proposed_name: string;
  rank: number;
  status: NameRequestStatus;
  rejection_reason: string | null;
  decided_at: string | null;
}

export interface CompanyDocument {
  id: string;
  company_id: string;
  required_document_id: string;
  shareholder_id: string | null;
  file_url: string;
  file_name: string;
  file_size: number;
  status: "UPLOADED" | "VALIDATED" | "REJECTED";
}

export interface CompanyPayment {
  id: string;
  company_id: string;
  reference: string;
  package_price_aed: number;
  office_price_aed: number;
  mao_fee_aed: number;
  total_aed: number;
  status: "PENDING" | "PAID";
  paid_at: string | null;
}

export interface CompanyStatusHistoryEntry {
  status: CompanyStatus;
  changed_at: string;
}

export interface CompanyLicenceHistoryEntry {
  action: "attribuee" | "renouvelee";
  number: string;
  type: string;
  expires_at: string;
  changed_at: string;
}

export interface CompanyRenewalTicket {
  reference: string;
  created_at: string;
  message: string;
  status: string;
}

/** Row of `company` as read by the app (+ the joined labels it needs). */
export interface Company {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string | null;
  jurisdiction_type: JurisdictionType | null;
  authority_id: string | null;
  legal_form_id: string | null;
  client_choice: ClientChoice | null;
  licence_type_id: string | null;
  office_type_id: string | null;
  visa_quota: number | null;
  lease_mode: LeaseMode | null;
  trade_name: string | null;
  licence_number: string | null;
  licence_issued_at: string | null;
  licence_expires_at: string | null;
  status: CompanyStatus;
  accounting: boolean;
  tracking_reference: string | null;
  requester_name: string | null;
  rejection_reason: string | null;
  status_history: CompanyStatusHistoryEntry[];
  licence_history: CompanyLicenceHistoryEntry[];
  licence_renewal_tickets: CompanyRenewalTicket[];
  is_legacy: boolean;
  legacy_data: Record<string, unknown>;
}

/** A company with its related rows, as used by the wizard / tracking page. */
export interface CompanyFile extends Company {
  authority: Authority | null;
  legal_form: LegalForm | null;
  licence_type: LicenceType | null;
  office_type: OfficeType | null;
  activity_ids: string[];
  names: CompanyNameRequest[];
  shareholders: Shareholder[];
  documents: CompanyDocument[];
  payment: CompanyPayment | null;
}
