/**
 * Shared types: support inbox, action results and company-user rights. The
 * company model itself lives in lib/company-types.ts.
 */

/**
 * Shared support inbox: both the "Contacts" page (a free-form message to the
 * admin) and license renewal requests (see requestLicenseRenewal in
 * app/actions/companies.ts) end up as rows here, so the "Support" page can
 * list everything in one place. Like the rest of this app's support-ticket
 * flows, this is a demo stand-in — no real email/helpdesk integration.
 */
export type SupportTicketType = "contact" | "license_renewal";
export type SupportTicketStatus = "ouvert" | "traite";
/** The société's verdict on a ticket the admin marked as treated. */
export type SupportTicketApproval = "approuve" | "refuse";

export interface SupportTicket {
  id: string;
  created_at: string;
  type: SupportTicketType;
  reference: string;
  subject: string;
  message: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  /** The message came from someone without an account. */
  is_visitor: boolean;
  company_id: string | null;
  company_name: string | null;
  status: SupportTicketStatus;
  follow_up_count: number;
  last_follow_up_at: string | null;
  approval: SupportTicketApproval | null;
  approval_comment: string | null;
  approval_at: string | null;
}

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
  /** Rule violations (see lib/company-domain.ts), when the refusal has several. */
  issues?: { code: string; params?: Record<string, string | number> }[];
}

/**
 * Sections of the app a société user can be given rights on (see the
 * "Administration > Utilisateurs" page and `company_user` in
 * supabase/migrations/0005_societe_users.sql (now company_user)).
 */
export const PERMISSION_SECTIONS = [
  "societe",
  "visa",
  "support",
  "comptabilite",
  "admin",
] as const;
export type PermissionSection = (typeof PERMISSION_SECTIONS)[number];

export interface SectionPermission {
  read: boolean;
  write: boolean;
}

export type CompanyUserPermissions = Record<PermissionSection, SectionPermission>;

export interface CompanyUser {
  id: string;
  created_at: string;
  company_id: string;
  name: string;
  email: string;
  permissions: CompanyUserPermissions;
}
