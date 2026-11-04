/**
 * Requests from the MAO team to the developers: a change to an existing
 * feature, a new feature, or a bug. Mirrors the CHECKs of migration 0012.
 * Pure: unit-tested.
 */

export const DEV_KINDS = ["FEATURE", "CHANGE", "BUG"] as const;
export const DEV_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;
export const DEV_STATUSES = ["NEW", "IN_PROGRESS", "DONE", "DECLINED"] as const;

export type DevKind = (typeof DEV_KINDS)[number];
export type DevPriority = (typeof DEV_PRIORITIES)[number];
export type DevStatus = (typeof DEV_STATUSES)[number];

export interface DevRequest {
  id: string;
  created_at: string;
  updated_at: string;
  reference: string;
  kind: DevKind;
  title: string;
  description: string;
  priority: DevPriority;
  status: DevStatus;
  requester_name: string | null;
  requester_email: string | null;
  dev_comment: string | null;
}

export type DevIssueCode =
  | "KIND_INVALID"
  | "PRIORITY_INVALID"
  | "TITLE_TOO_SHORT"
  | "DESCRIPTION_TOO_SHORT"
  | "STATUS_INVALID"
  | "COMMENT_REQUIRED";

export function validateDevRequest(i: {
  kind: string;
  priority: string;
  title: string;
  description: string;
}): DevIssueCode[] {
  const issues: DevIssueCode[] = [];
  if ((DEV_KINDS as readonly string[]).indexOf(i.kind) === -1) issues.push("KIND_INVALID");
  if ((DEV_PRIORITIES as readonly string[]).indexOf(i.priority) === -1) issues.push("PRIORITY_INVALID");
  if (i.title.trim().length < 3) issues.push("TITLE_TOO_SHORT");
  if (i.description.trim().length < 10) issues.push("DESCRIPTION_TOO_SHORT");
  return issues;
}

/** A declined request must say why. */
export function validateDevStatusChange(status: string, comment: string): DevIssueCode[] {
  if ((DEV_STATUSES as readonly string[]).indexOf(status) === -1) return ["STATUS_INVALID"];
  if (status === "DECLINED" && comment.trim().length < 3) return ["COMMENT_REQUIRED"];
  return [];
}

export function generateDevReference(now = new Date()): string {
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `DEV-${ymd}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
}
