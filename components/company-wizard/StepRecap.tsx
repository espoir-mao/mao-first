"use client";

import type { ReactNode } from "react";
import type { CompanyCatalog, CompanyFile } from "@/lib/company-types";
import { documentChecklist } from "@/lib/company-domain";
import type { WizardStep } from "@/lib/company-wizard";
import { useLanguage } from "../LanguageProvider";

interface StepRecapProps {
  company: CompanyFile;
  catalog: CompanyCatalog;
  onEdit: (step: WizardStep) => void;
}

function Card({ title, step, onEdit, children }: { title: string; step: WizardStep; onEdit: (s: WizardStep) => void; children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400">{title}</h3>
        <button type="button" onClick={() => onEdit(step)} className="text-xs font-bold text-[#4a5f34] underline-offset-2 hover:underline">
          {t("recap.edit")}
        </button>
      </div>
      <div className="flex flex-col gap-1.5 text-sm text-neutral-800">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-right font-semibold">{value || "—"}</span>
    </div>
  );
}

function Chip({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "grey" }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
        tone === "green" ? "bg-spring-50 text-[#3f5029]" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {children}
    </span>
  );
}

/** Final screen before payment: everything entered, section by section, each editable. */
export default function StepRecap({ company, catalog, onEdit }: StepRecapProps) {
  const { t, tEmirate } = useLanguage();
  const activities = catalog.activities.filter((a) => company.activity_ids.indexOf(a.id) !== -1);
  const names = company.names.filter((n) => n.rank <= 3).sort((a, b) => a.rank - b.rank);
  const checklist =
    company.authority_id && company.legal_form_id
      ? documentChecklist(
          company.authority_id,
          company.legal_form_id,
          company.activity_ids,
          catalog.requiredDocuments,
          company.shareholders.map((s) => ({
            id: s.id,
            isPerson: s.person_id !== null,
            isManager: s.is_manager,
            isParentCompany: s.parent_company_id !== null,
          })),
          company.documents
        )
      : [];
  const provided = checklist.filter((i) => i.provided).length;
  const mainland = company.jurisdiction_type === "MAINLAND";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Card title={t("recap.section.where")} step="regime" onEdit={onEdit}>
        <Row label={t("recap.regime")} value={company.jurisdiction_type ? t(`jurisdiction.${company.jurisdiction_type}`) : ""} />
        <Row label={t("recap.authority")} value={company.authority?.name} />
        <Row label={t("recap.emirate")} value={company.authority ? tEmirate(company.authority.emirate) : ""} />
      </Card>

      <Card title={t("recap.section.structure")} step="structure" onEdit={onEdit}>
        <Row label={t("recap.choice")} value={company.client_choice ? t(`company.choice.${company.client_choice}`) : ""} />
        <Row label={t("recap.legalForm")} value={company.legal_form?.label} />
      </Card>

      <Card title={t("recap.section.activities")} step="activities" onEdit={onEdit}>
        <div className="flex flex-wrap gap-1.5">
          {activities.map((a) => (
            <Chip key={a.id}>{a.label}</Chip>
          ))}
        </div>
        <Row label={t("recap.licenceType")} value={company.licence_type?.label} />
      </Card>

      <Card title={t("recap.section.names")} step="name" onEdit={onEdit}>
        {names.map((n) => (
          <div key={n.id} className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-spring-50 text-[11px] font-extrabold text-[#3f5029]">
              {n.rank}
            </span>
            <span className="font-semibold">{n.proposed_name}</span>
          </div>
        ))}
      </Card>

      <Card title={t("recap.section.office")} step="office" onEdit={onEdit}>
        {!mainland && <Row label={t("recap.office")} value={company.office_type?.label} />}
        <Row label={t("recap.visas")} value={company.visa_quota} />
        <Row label={t("recap.accounting")} value={company.accounting ? t("company.yes") : t("company.no")} />
        {mainland && (
          <Row label={t("recap.lease")} value={company.lease_mode ? t(`company.lease.${company.lease_mode}`) : ""} />
        )}
      </Card>

      <Card title={t("recap.section.documents")} step="documents" onEdit={onEdit}>
        <Row label={t("recap.documents")} value={`${provided} / ${checklist.length}`} />
        <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-[#7a9a5a]"
            style={{ width: `${checklist.length === 0 ? 100 : Math.round((provided / checklist.length) * 100)}%` }}
          />
        </div>
      </Card>

      <div className="sm:col-span-2">
        <Card title={t("recap.section.holders")} step="holders" onEdit={onEdit}>
          <div className="flex flex-col divide-y divide-neutral-100">
            {company.shareholders.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <div className="flex flex-col">
                  <span className="font-semibold">
                    {s.person ? `${s.person.first_name} ${s.person.last_name}` : s.parent_company?.name}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {s.person ? s.person.nationality ?? "" : s.parent_company?.country ?? ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {s.is_manager && <Chip>{t("recap.manager")}</Chip>}
                  <Chip tone="grey">{Number(s.share_pct)} %</Chip>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
