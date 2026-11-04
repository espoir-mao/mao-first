import type { Issue } from "./company-domain";

type T = (key: string, params?: Record<string, string | number>) => string;

/** Human message of a rule violation (see lib/company-domain.ts). */
export function issueMessage(t: T, issue: { code: string; params?: Record<string, string | number> }): string {
  return t(`company.issue.${issue.code}`, issue.params);
}

export function firstIssueMessage(
  t: T,
  result: { error?: string; issues?: Issue[] },
  fallback: string
): string {
  if (result.issues && result.issues.length > 0) return issueMessage(t, result.issues[0]);
  return result.error ?? fallback;
}
