/**
 * Correction requests: MAO raises an inconsistency or an additional request on
 * a company file or on one of its visa applications; the company answers (text
 * and/or attachments); MAO closes it. Pure rules, mirroring the CHECKs and the
 * guard trigger of supabase/migrations/0009_backoffice_review.sql.
 */

export const COMPANY_SECTIONS = [
  "STRUCTURE",
  "ACTIVITIES",
  "NAMES",
  "OFFICE",
  "HOLDERS",
  "DOCUMENTS",
  "OTHER",
] as const;
export const VISA_SECTIONS = ["VISA_APPLICANT", "VISA_DOCUMENTS", "VISA_OTHER"] as const;
export type CorrectionSection = (typeof COMPANY_SECTIONS)[number] | (typeof VISA_SECTIONS)[number];

export type CorrectionStatus = "OUVERT" | "REPONDU" | "CLOTURE";

export interface CorrectionFile {
  name: string;
  url: string;
  size?: number;
}

export interface CorrectionRequest {
  id: string;
  created_at: string;
  reference: string;
  company_id: string;
  visa_application_id: string | null;
  section: CorrectionSection;
  message: string;
  status: CorrectionStatus;
  response: string | null;
  response_files: CorrectionFile[];
  answered_at: string | null;
  closed_at: string | null;
  /** false once MAO waived it: it stays open but no longer blocks the next step. */
  is_blocking: boolean;
  waiver_reason: string | null;
  waived_at: string | null;
}

export type CorrectionIssueCode =
  | "MESSAGE_TOO_SHORT"
  | "SECTION_INVALID"
  | "ANSWER_EMPTY"
  | "NOT_OPEN"
  | "NOT_CLOSABLE"
  | "WAIVER_REASON_TOO_SHORT"
  | "NOT_WAIVABLE";

export const WAIVER_MIN_LENGTH = 10;

export function sectionsFor(isVisa: boolean): readonly CorrectionSection[] {
  return isVisa ? VISA_SECTIONS : COMPANY_SECTIONS;
}

export function validateRaise(input: {
  section: string;
  message: string;
  isVisa: boolean;
  /** Set (with its explanation) to raise the request as non blocking. */
  nonBlockingReason?: string | null;
}): CorrectionIssueCode[] {
  const issues: CorrectionIssueCode[] = [];
  if (input.nonBlockingReason !== undefined && input.nonBlockingReason !== null) {
    if (input.nonBlockingReason.trim().length < WAIVER_MIN_LENGTH) issues.push("WAIVER_REASON_TOO_SHORT");
  }
  if (!(sectionsFor(input.isVisa) as readonly string[]).includes(input.section)) {
    issues.push("SECTION_INVALID");
  }
  if (input.message.trim().length < 5) issues.push("MESSAGE_TOO_SHORT");
  return issues;
}

/** An answer needs a text (2+ characters) or at least one attachment. */
export function validateAnswer(
  current: Pick<CorrectionRequest, "status">,
  response: string,
  files: CorrectionFile[]
): CorrectionIssueCode[] {
  if (current.status !== "OUVERT") return ["NOT_OPEN"];
  if (response.trim().length < 2 && files.length === 0) return ["ANSWER_EMPTY"];
  return [];
}

export function validateClose(current: Pick<CorrectionRequest, "status">): CorrectionIssueCode[] {
  return current.status === "CLOTURE" ? ["NOT_CLOSABLE"] : [];
}

/** Not closed yet: waiting for the company, or waiting for MAO to close. */
export function isUnresolved(c: Pick<CorrectionRequest, "status">): boolean {
  return c.status !== "CLOTURE";
}

/** Stops the next step of the file / the grant of the visa (unresolved and not waived). */
export function isBlocking(c: Pick<CorrectionRequest, "status"> & { is_blocking?: boolean }): boolean {
  return c.status !== "CLOTURE" && c.is_blocking !== false;
}

/** MAO waives a pending request: it stops blocking, with a mandatory explanation. */
export function validateWaiver(
  current: Pick<CorrectionRequest, "status"> & { is_blocking?: boolean },
  reason: string
): CorrectionIssueCode[] {
  if (current.status === "CLOTURE" || current.is_blocking === false) return ["NOT_WAIVABLE"];
  if (reason.trim().length < WAIVER_MIN_LENGTH) return ["WAIVER_REASON_TOO_SHORT"];
  return [];
}

export function generateCorrectionReference(now = new Date()): string {
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `COR-${ymd}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
}
