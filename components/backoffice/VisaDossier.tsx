"use client";

import Link from "next/link";
import { useLanguage } from "../LanguageProvider";
import type { VisaApplication, VisaAppointment } from "@/lib/visa-types";
import type { CorrectionRequest } from "@/lib/correction";
import CorrectionManager from "../corrections/CorrectionManager";
import { Field, FileLink, Grid, Section } from "./DossierParts";

interface Props {
  visa: VisaApplication;
  companyName: string | null;
  corrections: CorrectionRequest[];
}

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Backoffice MAO — the whole visa application: applicant, branch-specific
 * answers, uploaded documents, appointments, address, fees, decision, and the
 * corrections / additional requests sent back to the company.
 */
export default function VisaDossier({ visa, companyName, corrections }: Props) {
  const { t } = useLanguage();
  const a = visa.applicant;
  const branch = (visa.branch_data ?? {}) as Record<string, unknown>;
  const dependents = Array.isArray(branch.dependents) ? (branch.dependents as Record<string, string>[]) : [];
  const branchEntries = Object.entries(branch).filter(([k, v]) => k !== "dependents" && show(v) !== "");
  const addr = visa.emirates_id_address;

  const appt = (label: string, ap: VisaAppointment | undefined) => (
    <Field
      label={label}
      value={ap && (ap.date || ap.center) ? `${ap.date ?? ""} ${ap.slot ?? ""} · ${ap.center ?? ""} · ${ap.status ?? ""}`.trim() : null}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/backoffice/visas" className="text-sm font-bold text-[#4f7a37] hover:underline">
          ← {t("dossier.visa.back")}
        </Link>
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {`${a?.prenom ?? ""} ${a?.nom ?? ""}`.trim() || visa.tracking_reference || visa.id}
        </h1>
        <p className="text-xs text-neutral-500">
          {t(`visa.type.${visa.visa_type}.label`)} · {visa.tracking_reference ?? "—"} · {visa.status} ·{" "}
          {visa.decision_status === "obtenu"
            ? t("visa.history.status.obtenu")
            : visa.decision_status === "rejete"
              ? t("visa.history.status.rejete")
              : t("dossier.visa.pending")}
        </p>
      </div>

      <Section title={t("dossier.visa.company")}>
        {visa.company_id ? (
          <Link href={`/backoffice/societes/${visa.company_id}`} className="text-sm font-bold text-[#4f7a37] hover:underline">
            {companyName ?? visa.company_id} →
          </Link>
        ) : (
          <p className="text-sm text-neutral-500">{t("admin.visas.societe.none")}</p>
        )}
      </Section>

      <Section title={t("dossier.visa.applicant")}>
        <Grid>
          <Field label={t("profile.info.firstName")} value={a?.prenom} />
          <Field label={t("profile.info.lastName")} value={a?.nom} />
          <Field label={t("dossier.nationality")} value={a?.nationalite} />
          <Field label={t("dossier.birthDate")} value={a?.date_naissance} />
          <Field label={t("dossier.passport")} value={a?.numero_passeport} />
          <Field label={t("profile.info.email")} value={a?.email} />
          <Field label={t("dossier.phone")} value={a?.telephone} />
        </Grid>
      </Section>

      <Section title={t("dossier.visa.branch")}>
        {branchEntries.length === 0 && dependents.length === 0 ? (
          <p className="text-sm text-neutral-500">—</p>
        ) : (
          <>
            <Grid>
              {branchEntries.map(([k, v]) => (
                <Field key={k} label={humanize(k)} value={show(v)} />
              ))}
            </Grid>
            {dependents.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-neutral-700">
                {dependents.map((d, i) => (
                  <li key={i}>
                    {d.prenom} {d.nom} — {d.lien} {d.date_naissance ? `(${d.date_naissance})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      <Section title={t("dossier.section.documents")}>
        {(visa.documents ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">—</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {visa.documents.map((d) => (
              <li key={d.path ?? d.url}>
                <FileLink url={d.url} name={d.name} size={d.size} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("dossier.visa.appointments")}>
        <Grid>
          {appt(t("dossier.visa.medical"), visa.medical_appointment)}
          {appt(t("dossier.visa.biometric"), visa.biometric_appointment)}
          <Field label={t("dossier.visa.address")} value={[addr?.address_line1, addr?.address_line2, addr?.city, addr?.emirate, addr?.po_box].filter(Boolean).join(", ")} />
          <Field label={t("dossier.phone")} value={addr?.phone} />
        </Grid>
      </Section>

      <Section title={t("dossier.visa.fees")}>
        {visa.payment_estimate?.items?.length ? (
          <ul className="flex flex-col gap-1 text-sm text-neutral-700">
            {visa.payment_estimate.items.map((i) => (
              <li key={i.key} className="flex justify-between gap-3">
                <span>{t(`visa.fee.${i.key}`)}</span>
                <span>{Math.round(i.amount).toLocaleString("fr-FR")} AED</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-neutral-100 pt-1 font-bold">
              <span>{t("dossier.payment.total")}</span>
              <span>{Math.round(visa.payment_estimate.total).toLocaleString("fr-FR")} AED</span>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">—</p>
        )}
      </Section>

      {visa.company_id && <CorrectionManager companyId={visa.company_id} visaId={visa.id} initial={corrections} />}
    </div>
  );
}
