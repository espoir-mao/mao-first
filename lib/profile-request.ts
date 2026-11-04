/**
 * Profile change requests: types and pure validation (mirrors the CHECKs of
 * supabase/migrations/0008_profile_change_request.sql). No imports, so it can
 * be unit-tested directly with node.
 */

export type HolderStatus = "MANAGER" | "SHAREHOLDER";
export const HOLDER_STATUSES: readonly HolderStatus[] = ["MANAGER", "SHAREHOLDER"];

export interface ProfileValues {
  first_name?: string;
  last_name?: string;
  email?: string;
  holder_status?: HolderStatus;
}

export type ProfileRequestStatus = "ouvert" | "approuve" | "refuse";

export interface ProfileChangeRequest {
  id: string;
  created_at: string;
  reference: string;
  user_id: string;
  user_email: string | null;
  company_id: string | null;
  company_name: string | null;
  current_values: ProfileValues;
  requested_values: ProfileValues;
  reason: string | null;
  status: ProfileRequestStatus;
  decided_at: string | null;
  decision_comment: string | null;
}

export type ProfileIssueCode =
  | "NO_CHANGE"
  | "NAME_REQUIRED"
  | "NAME_TOO_LONG"
  | "EMAIL_INVALID"
  | "STATUS_INVALID";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const KEYS = ["first_name", "last_name", "email", "holder_status"] as const;

/**
 * Keeps only the fields that differ from `current` (trimmed). Returns the
 * cleaned diff plus the list of rule violations (empty = can be submitted).
 */
export function buildProfileRequest(
  current: ProfileValues,
  wanted: ProfileValues
): { values: ProfileValues; issues: ProfileIssueCode[] } {
  const values: ProfileValues = {};
  const issues: ProfileIssueCode[] = [];

  for (const key of KEYS) {
    const raw = wanted[key];
    if (raw === undefined || raw === null) continue;
    const next = typeof raw === "string" ? raw.trim() : raw;
    if (next === (current[key] ?? "")) continue;

    if (key === "first_name" || key === "last_name") {
      if (!next) issues.push("NAME_REQUIRED");
      else if ((next as string).length > 80) issues.push("NAME_TOO_LONG");
      else values[key] = next as string;
    } else if (key === "email") {
      if (!EMAIL_RE.test(next as string)) issues.push("EMAIL_INVALID");
      else values.email = next as string;
    } else if (!HOLDER_STATUSES.includes(next as HolderStatus)) {
      issues.push("STATUS_INVALID");
    } else {
      values.holder_status = next as HolderStatus;
    }
  }

  if (issues.length === 0 && Object.keys(values).length === 0) issues.push("NO_CHANGE");
  return { values, issues };
}

/** Values to display: the auth metadata overlaid by every APPROVED request, oldest first. */
export function effectiveProfile(
  base: ProfileValues,
  requests: Pick<ProfileChangeRequest, "status" | "created_at" | "requested_values">[]
): ProfileValues {
  return [...requests]
    .filter((r) => r.status === "approuve")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .reduce<ProfileValues>((acc, r) => ({ ...acc, ...r.requested_values }), { ...base });
}

export function generateProfileRequestReference(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `PRO-${ymd}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
