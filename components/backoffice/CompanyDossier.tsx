"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useLanguage } from "../LanguageProvider";
import type { CompanyCatalog, CompanyFile, Shareholder } from "@/lib/company-types";
import type { CorrectionRequest } from "@/lib/correction";
import type { VisaApplication } from "@/lib/visa-types";
import { documentChecklist } from "@/lib/company-domain";
import { companyDisplayName, formatAed, statusBadgeClasses } from "@/lib/company-view";
import { completeShareholderKyc, startShareholderKyc } from "@/app/actions/companies";
import CorrectionManager from "../corrections/CorrectionManager";
import { Field, FileLink, Grid, Section, smallBtn, smallBtnSecondary } from "./DossierParts";

interface Props {
  initial: CompanyFile;
  catalog: CompanyCatalog;
  corrections: CorrectionRequest[];
  visas: VisaApplication[];
}

const KYC_BADGE: Record<Shareholder["kyc_status"], string> = {
  NOT_STARTED: "bg-neutral-100 text-neutral-600",
  PENDING: "bg-amber-100 text-amber-700",
  VERIFIED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  NOT_APPLICABLE: "bg-neutral-100 text-neutral-500",
};

/**
 * Backoffice MAO — the whole file of one company, in creation or already
 * created: every answer given in the creation flow, every uploaded document,
 * the identity check (KYC) of the shareholders (done here by MAO, not by the
 * client), and the corrections / additional requests sent back to the company.
 */
export default function CompanyDossier({ initial, catalog, corrections, visas }: Props) {
  const { t } = useLanguage();
  const [company, setCompany] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activities = catalog.activities.filter((a) => company.activity_ids.indexOf(a.id) !== -1);
  const isDraft = company.status === "DRAFT";

  const checklist = useMemo(
    () =>
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
            company.documents,
            company.lease_mode
          )
        : [],
    [company, catalog.requiredDocuments]
  );

  function holderName(id: string | null): string {
    if (!id) return t("company.docs.forCompany");
    const s = company.shareholders.find((x) => x.id === id);
    if (!s) return "";
    return s.person ? `${s.person.first_name} ${s.person.last_name}` : s.parent_company?.name ?? "";
  }

  function kyc(shareholderId: string, run: () => Promise<{ success: boolean; data?: CompanyFile; error?: string }>) {
    setError(null);
    setBusyId(shareholderId);
    startTransition(async () => {
      const res = await run();
      setBusyId(null);
      if (!res.success || !res.data) return setError(res.error ?? t("company.holders.kyc.error"));
      setCompany(res.data);
    });
  }

  const legacyDocs = Array.isArray((company.legacy_data as { documents?: unknown }).documents)
    ? ((company.legacy_data as { documents: { name?: string; url?: string; size?: number }[] }).documents ?? [])
    : [];

  const unverified = company.shareholders.some(
    (s) => s.person_id && (Number(s.share_pct) > 0 || s.is_manager) && s.kyc_status !== "VERIFIED"
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/backoffice/societes" className="text-sm font-bold text-[#4f7a37] hover:underline">
          ← {t("dossier.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
            {companyDisplayName(company) ?? t("company.draft.untitled")}
          </h1>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClasses(company.status)}`}>
            {t(`status.${company.status}`)}
          </span>
        </div>
        <p className="text-xs text-neutral-500">
          {t("admin.societes.tracking.label")}: {company.tracking_reference ?? "—"} · {t("admin.societes.requester.label")}:{" "}
          {company.requester_name ?? t("societe.requester.unknown")}
        </p>
        {isDraft && <p className="text-sm text-amber-700">{t("dossier.draftNotice")}</p>}
      </div>

      <Section title={t("dossier.section.structure")}>
        <Grid>
          <Field label={t("dossier.regime")} value={company.jurisdiction_type ? t(`dossier.regime.${company.jurisdiction_type}`) : null} />
          <Field label={t("dossier.authority")} value={company.authority ? `${company.authority.name} (${company.authority.emirate})` : null} />
          <Field label={t("dossier.clientChoice")} value={company.client_choice ? t(`company.choice.${company.client_choice}`) : null} />
          <Field label={t("dossier.legalForm")} value={company.legal_form?.label} />
          <Field label={t("dossier.licenceType")} value={company.licence_type?.label} />
          <Field label={t("dossier.office")} value={company.office_type?.label} />
          <Field label={t("dossier.visaQuota")} value={company.visa_quota} />
          {company.jurisdiction_type === "MAINLAND" && (
            <Field label={t("dossier.lease")} value={company.lease_mode ? t(`company.lease.${company.lease_mode}`) : "—"} />
          )}
          <Field label={t("dossier.accounting")} value={company.accounting ? t("dossier.yes") : t("dossier.no")} />
        </Grid>
        {company.rejection_reason && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{company.rejection_reason}</p>
        )}
      </Section>

      <Section title={t("dossier.section.activities")}>
        {activities.length === 0 ? (
          <p className="text-sm text-neutral-500">{company.is_legacy ? String(company.legacy_data.activity_description ?? "—") : "—"}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {activities.map((a) => (
              <li key={a.id} className="rounded-full bg-[#eef4e4] px-3 py-1 text-xs font-semibold text-[#2f3b26]">
                {a.label}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("dossier.section.names")}>
        {company.names.length === 0 ? (
          <p className="text-sm text-neutral-500">—</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...company.names].sort((a, b) => a.rank - b.rank).map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 px-3 py-2 text-sm">
                <span>
                  <span className="text-xs font-semibold text-neutral-400">#{n.rank}</span> <span className="font-semibold">{n.proposed_name}</span>
                  {n.rejection_reason ? <span className="ml-2 text-xs text-red-700">{n.rejection_reason}</span> : null}
                </span>
                <span className="text-xs font-bold text-neutral-500">{t(`company.name.status.${n.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t("dossier.section.holders")}
        aside={
          unverified && !isDraft ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
              {t("dossier.kyc.blocking")}
            </span>
          ) : null
        }
      >
        <p className="text-xs text-neutral-500">{t("dossier.kyc.intro")}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {company.shareholders.length === 0 ? (
          <p className="text-sm text-neutral-500">—</p>
        ) : (
          <div className="flex flex-col gap-3">
            {company.shareholders.map((s) => {
              const busy = isPending && busyId === s.id;
              return (
                <div key={s.id} className="flex flex-col gap-3 rounded-xl border border-neutral-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-neutral-900">
                        {s.person ? `${s.person.first_name} ${s.person.last_name}` : s.parent_company?.name}
                        {s.is_manager && (
                          <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold uppercase text-sky-700">
                            {t("profile.status.MANAGER")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">{Number(s.share_pct)} %</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${KYC_BADGE[s.kyc_status]}`}>
                      {t(`company.kyc.status.${s.kyc_status}`)}
                      {s.kyc_reference ? ` · ${s.kyc_reference}` : ""}
                    </span>
                  </div>
                  {s.person && (
                    <Grid>
                      <Field label={t("profile.info.email")} value={s.person.email} />
                      <Field label={t("dossier.phone")} value={s.person.phone} />
                      <Field label={t("dossier.nationality")} value={s.person.nationality} />
                      <Field label={t("dossier.passport")} value={s.person.passport_number} />
                      <Field label={t("dossier.birthDate")} value={s.person.birth_date} />
                    </Grid>
                  )}
                  {s.parent_company && (
                    <Grid>
                      <Field label={t("dossier.parent.country")} value={s.parent_company.country} />
                      <Field label={t("dossier.parent.registration")} value={s.parent_company.registration_number} />
                    </Grid>
                  )}
                  {s.person_id && (
                    <div className="flex flex-wrap items-center gap-2">
                      {isDraft ? (
                        <span className="text-xs text-neutral-500">{t("dossier.kyc.afterSubmission")}</span>
                      ) : (
                        <>
                          {(s.kyc_status === "NOT_STARTED" || s.kyc_status === "REJECTED") && (
                            <button type="button" disabled={busy} onClick={() => kyc(s.id, () => startShareholderKyc(s.id))} className={smallBtn}>
                              {busy ? t("company.kyc.starting") : t("company.kyc.start")}
                            </button>
                          )}
                          {s.kyc_status === "PENDING" && (
                            <>
                              <button type="button" disabled={busy} onClick={() => kyc(s.id, () => completeShareholderKyc(s.id, "VERIFIED"))} className={smallBtn}>
                                {t("company.kyc.simulate.ok")}
                              </button>
                              <button type="button" disabled={busy} onClick={() => kyc(s.id, () => completeShareholderKyc(s.id, "REJECTED"))} className={smallBtnSecondary}>
                                {t("company.kyc.simulate.ko")}
                              </button>
                            </>
                          )}
                          {s.kyc_status === "REJECTED" && (
                            <span className="text-xs text-red-700">{t("dossier.kyc.rejectedHint")}</span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-neutral-400">{t("company.kyc.simulated")}</p>
      </Section>

      <Section title={t("dossier.section.documents")}>
        {checklist.length === 0 && company.documents.length === 0 && legacyDocs.length === 0 ? (
          <p className="text-sm text-neutral-500">—</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {checklist.map((item) => {
              const doc = company.documents.find(
                (d) => d.required_document_id === item.required_document_id && d.shareholder_id === item.shareholder_id
              );
              return (
                <li key={`${item.required_document_id}:${item.shareholder_id ?? "-"}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold text-neutral-800">{item.label}</span>
                    <span className="ml-2 text-xs text-neutral-500">{holderName(item.shareholder_id)}</span>
                  </span>
                  {doc ? (
                    <FileLink url={doc.file_url} name={doc.file_name} size={doc.file_size} />
                  ) : item.optional ? (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold uppercase text-neutral-500">
                      {t("company.docs.optional")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase text-red-600">
                      {t("dossier.documents.missing")}
                    </span>
                  )}
                </li>
              );
            })}
            {legacyDocs.map((d, i) =>
              d.url ? (
                <li key={`legacy-${i}`} className="rounded-xl border border-neutral-100 px-3 py-2">
                  <FileLink url={d.url} name={d.name ?? `document-${i + 1}`} size={d.size} />
                </li>
              ) : null
            )}
          </ul>
        )}
      </Section>

      <Section title={t("dossier.section.payment")}>
        {company.payment ? (
          <Grid>
            <Field label={t("dossier.payment.reference")} value={company.payment.reference} />
            <Field label={t("dossier.payment.status")} value={company.payment.status} />
            <Field label={t("dossier.payment.package")} value={formatAed(Number(company.payment.package_price_aed))} />
            <Field label={t("dossier.payment.office")} value={formatAed(Number(company.payment.office_price_aed))} />
            <Field label={t("dossier.payment.fee")} value={formatAed(Number(company.payment.mao_fee_aed))} />
            <Field label={t("dossier.payment.total")} value={formatAed(Number(company.payment.total_aed))} />
          </Grid>
        ) : (
          <p className="text-sm text-neutral-500">—</p>
        )}
      </Section>

      <Section title={t("home.about.status.history.title")}>
        <ul className="flex flex-col gap-1 text-sm text-neutral-700">
          {company.status_history.map((h, i) => (
            <li key={i}>
              <span className="font-semibold">{t(`status.${h.status}`)}</span> — {new Date(h.changed_at).toLocaleString()}
            </li>
          ))}
        </ul>
        {company.licence_number && (
          <Grid>
            <Field label={t("dossier.licenceNumber")} value={company.licence_number} />
            <Field label={t("dossier.licenceExpires")} value={company.licence_expires_at ? new Date(company.licence_expires_at).toLocaleDateString() : null} />
          </Grid>
        )}
      </Section>

      {visas.length > 0 && (
        <Section title={t("dossier.section.visas")}>
          <ul className="flex flex-col gap-2">
            {visas.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold">{`${v.applicant?.prenom ?? ""} ${v.applicant?.nom ?? ""}`.trim() || v.tracking_reference || v.id}</span>
                  <span className="ml-2 text-xs text-neutral-500">{t(`visa.type.${v.visa_type}.label`)} · {v.decision_status === "obtenu" ? t("visa.history.status.obtenu") : v.decision_status === "rejete" ? t("visa.history.status.rejete") : t("dossier.visa.pending")}</span>
                </span>
                <Link href={`/backoffice/visas/${v.id}`} className="text-xs font-bold text-[#4f7a37] hover:underline">
                  {t("dossier.open")} →
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CorrectionManager companyId={company.id} initial={corrections} />
    </div>
  );
}
