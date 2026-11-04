import type { CompanyFile, CompanyStatus } from "./company-types";

/** Name shown for a company: approved trade name, else first proposal. */
export function companyDisplayName(c: CompanyFile): string | null {
  return c.trade_name ?? c.names.find((n) => n.rank === 1)?.proposed_name ?? c.names[0]?.proposed_name ?? null;
}

/** Tailwind classes of a status badge. */
export function statusBadgeClasses(status: CompanyStatus): string {
  switch (status) {
    case "LICENCE_ISSUED":
      return "bg-emerald-100 text-emerald-700";
    case "NAME_APPROVED":
    case "INITIAL_APPROVAL":
      return "bg-sky-100 text-sky-700";
    case "SUBMITTED":
    case "IN_REVIEW":
      return "bg-amber-100 text-amber-700";
    case "NAME_REJECTED":
    case "REJECTED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-neutral-200 text-neutral-600";
  }
}

/** Where the "open" action of a company leads: wizard while DRAFT, tracking after. */
export function companyHref(c: Pick<CompanyFile, "id" | "status">): string {
  return c.status === "DRAFT" ? `/societes/${c.id}/modifier` : `/societes/${c.id}/suivi`;
}

export function hasLicence(c: Pick<CompanyFile, "licence_number">): boolean {
  return Boolean(c.licence_number);
}

/** Companies that are fully set up (licence issued): the only ones a visa can target. */
export function isOperational(c: Pick<CompanyFile, "status">): boolean {
  return c.status === "LICENCE_ISSUED";
}

/** Formats an amount in AED. */
export function formatAed(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} AED`;
}
