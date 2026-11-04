"use client";

import { CorrectionBanner } from "../corrections/CompanyCorrections";
import Link from "next/link";
import type { CompanyFile } from "@/lib/company-types";
import { companyHref } from "@/lib/company-view";
import { useLanguage } from "../LanguageProvider";
import CompanyTracking from "./CompanyTracking";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

interface AProposPanelProps {
  societe: CompanyFile;
  onUpdated: (updated: CompanyFile) => void;
}

/**
 * "À propos" sub-page for the active société: the follow-up of its
 * creation file (CompanyTracking) and the structured facts the file holds —
 * authority, legal form, licence type, office, visa quota, activities and
 * shareholders. A draft is resumed in the creation wizard; once submitted the
 * structure is frozen (the database refuses changes).
 */
export default function AProposPanel({ societe, onUpdated }: AProposPanelProps) {
  const { t, tEmirate } = useLanguage();

  const legacyActivity = societe.is_legacy
    ? (societe.legacy_data?.activity_description as string | undefined)
    : undefined;

  const rows: { label: string; value: string }[] = [
    { label: t("home.about.tracking.label"), value: societe.tracking_reference ?? "—" },
    { label: t("home.about.createdAt.label"), value: formatDateTime(societe.created_at) },
    { label: t("home.about.requester.label"), value: societe.requester_name ?? t("societe.requester.unknown") },
    {
      label: t("company.about.jurisdiction"),
      value: societe.jurisdiction_type ? t(`jurisdiction.${societe.jurisdiction_type}`) : "—",
    },
    {
      label: t("company.about.authority"),
      value: societe.authority ? `${societe.authority.name} · ${tEmirate(societe.authority.emirate)}` : "—",
    },
    { label: t("company.about.legalForm"), value: societe.legal_form?.label ?? "—" },
    { label: t("company.about.licenceType"), value: societe.licence_type?.label ?? "—" },
    {
      label: t("company.about.office"),
      value: societe.office_type
        ? `${societe.office_type.label}${societe.office_type.provides_ejari ? " (Ejari)" : ""}`
        : "—",
    },
    { label: t("company.about.visaQuota"), value: societe.visa_quota === null ? "—" : String(societe.visa_quota) },
    { label: t("company.about.accounting"), value: societe.accounting ? t("company.yes") : t("company.no") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <CorrectionBanner companyId={societe.id} />
      <CompanyTracking company={societe} onUpdated={onUpdated} />

      <div className="rounded-2xl border border-neutral-100 bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-neutral-900">{t("home.tabs.about")}</h2>
          {societe.status === "DRAFT" && (
            <Link href={companyHref(societe)} className="text-sm font-bold text-[#4f7a37] hover:underline">
              {t("company.tracking.resume")} →
            </Link>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs font-bold uppercase tracking-wide text-neutral-400">{row.label}</dt>
              <dd className="mt-1 text-sm text-neutral-800">{row.value}</dd>
            </div>
          ))}
        </dl>

        {legacyActivity && (
          <div className="mt-5">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              {t("home.about.description.label")}
            </span>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{legacyActivity}</p>
          </div>
        )}

        {societe.shareholders.length > 0 && (
          <div className="mt-5">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              {t("company.about.shareholders")}
            </span>
            <ul className="mt-2 flex flex-col gap-1.5">
              {societe.shareholders.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-700"
                >
                  <span>
                    {s.person
                      ? `${s.person.first_name} ${s.person.last_name}`
                      : s.parent_company?.name ?? "—"}
                    {s.is_manager && (
                      <span className="ml-2 rounded-full bg-spring-200 px-2 py-0.5 text-[11px] font-bold text-[#3f5029]">
                        {t("company.holder.manager")}
                      </span>
                    )}
                  </span>
                  <span className="font-semibold">{Number(s.share_pct)} %</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
