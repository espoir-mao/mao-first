import type { CompanyCatalog, CompanyFile } from "./company-types";
import { documentChecklist } from "./company-domain.ts";

/** The eleven screens of the company-creation flow. */
export const WIZARD_STEPS = [
  "regime",
  "authority",
  "structure",
  "activities",
  "name",
  "office",
  "holders",
  "documents",
  "recap",
  "payment",
  "tracking",
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Index of the screen a (resumed) file should open on: the first incomplete one. */
export function firstIncompleteStep(
  file: CompanyFile,
  catalog: Pick<CompanyCatalog, "requiredDocuments">
): number {
  const idx = (s: WizardStep) => WIZARD_STEPS.indexOf(s);
  if (file.status !== "DRAFT") return idx("tracking");
  if (!file.jurisdiction_type) return idx("regime");
  if (!file.authority_id) return idx("authority");
  if (!file.client_choice || !file.legal_form_id) return idx("structure");
  if (file.activity_ids.length === 0 || !file.licence_type_id) return idx("activities");
  if (file.names.filter((n) => n.rank <= 3).length < 3) return idx("name");
  if (!file.office_type_id || file.visa_quota === null) return idx("office");
  const total = file.shareholders.reduce((s, h) => s + Number(h.share_pct), 0);
  if (file.shareholders.length === 0 || Math.round(total * 100) !== 10000) {
    return idx("holders");
  }
  const missing = documentChecklist(
    file.authority_id,
    file.legal_form_id,
    file.activity_ids,
    catalog.requiredDocuments,
    file.shareholders.map((s) => ({
      id: s.id,
      isPerson: s.person_id !== null,
      isManager: s.is_manager,
      isParentCompany: s.parent_company_id !== null,
    })),
    file.documents,
    file.lease_mode
  ).filter((i) => !i.provided && !i.optional);
  if (missing.length > 0) return idx("documents");
  if (file.jurisdiction_type === "MAINLAND" && !file.lease_mode) return idx("documents");
  return idx("recap");
}
