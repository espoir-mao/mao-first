"use client";

import type { VisaFormValues } from "@/lib/visa-schema";
import type { VisaStepId } from "@/lib/visa-types";
import type { CompanyFile } from "@/lib/company-types";
import { useLanguage } from "../LanguageProvider";
import { companyDisplayName } from "@/lib/company-view";

interface VisaReviewStepProps {
  values: VisaFormValues;
  onEditStep: (step: VisaStepId) => void;
  societes: CompanyFile[];
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
          {title}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-bold text-[#4a5f34] underline-offset-2 hover:underline"
        >
          {t("visa.step.review.edit")}
        </button>
      </div>
      <div className="text-sm text-neutral-800">{children}</div>
    </div>
  );
}

export default function VisaReviewStep({
  values,
  onEditStep,
  societes,
}: VisaReviewStepProps) {
  const { t, tOption } = useLanguage();
  const linkedSociete = values.company_id
    ? societes.find((s) => s.id === values.company_id)
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      <Section
        title={t("visa.step.review.section.applicant")}
        onEdit={() => onEditStep("applicant")}
      >
        <p className="font-semibold">
          {values.applicant.prenom} {values.applicant.nom}
        </p>
        <p className="mt-1 text-neutral-500">
          {values.applicant.nationalite} · {values.applicant.numero_passeport}
        </p>
        <p className="text-neutral-500">
          {values.applicant.email} · {values.applicant.telephone}
        </p>
      </Section>

      <Section
        title={t("visa.step.review.section.type")}
        onEdit={() => onEditStep("type")}
      >
        {t(`visa.type.${values.visa_type}.label`)}
      </Section>

      <Section
        title={t("visa.step.review.section.branch")}
        onEdit={() => onEditStep("branch")}
      >
        {(values.visa_type === "investor" || values.visa_type === "employee") && (
          <p>{linkedSociete ? (companyDisplayName(linkedSociete) ?? linkedSociete.id) : t("visa.step.review.none")}</p>
        )}
        {values.visa_type === "investor" && (
          <p className="mt-1 text-neutral-500">
            {values.branch.role_societe} —{" "}
            {values.branch.pourcentage_participation ?? "—"}%
          </p>
        )}
        {values.visa_type === "employee" && (
          <p className="mt-1 text-neutral-500">
            {values.branch.poste} —{" "}
            {values.branch.type_contrat
              ? tOption("visa.contract", values.branch.type_contrat)
              : ""}
          </p>
        )}
        {values.visa_type === "golden" && (
          <p>
            {values.branch.golden_categorie
              ? tOption("visa.golden", values.branch.golden_categorie)
              : ""}{" "}
            —{" "}
            {values.branch.golden_duree
              ? tOption("visa.golden.duree", values.branch.golden_duree)
              : ""}
          </p>
        )}
        {values.visa_type === "family" && (
          <>
            <p>
              {values.branch.sponsor_prenom} {values.branch.sponsor_nom} (
              {values.branch.family_lien_sponsor
                ? tOption("visa.family.lien", values.branch.family_lien_sponsor)
                : ""}
              )
            </p>
            <p className="mt-1 text-neutral-500">
              {(values.branch.dependents?.length ?? 0) === 0
                ? t("visa.step.review.noDependents")
                : `${values.branch.dependents?.length} ${t(
                    "visa.step.branch.family.dependents.title"
                  )}`}
            </p>
          </>
        )}
        {values.visa_type === "domestic" && (
          <p>
            {values.branch.domestic_poste
              ? tOption("visa.domestic", values.branch.domestic_poste)
              : ""}{" "}
            — {values.branch.domestic_sponsor_nom}
          </p>
        )}
        {values.visa_type === "remote" && (
          <p>
            {values.branch.remote_employeur_nom} —{" "}
            {values.branch.remote_employeur_pays}
          </p>
        )}
      </Section>

      <Section
        title={t("visa.step.review.section.documents")}
        onEdit={() => onEditStep("documents")}
      >
        {values.documents.length === 0
          ? t("visa.step.review.none")
          : t("visa.step.review.documentsCount", { n: values.documents.length })}
      </Section>

      <Section
        title={t("visa.step.review.section.appointments")}
        onEdit={() => onEditStep("appointments")}
      >
        <p>
          {t("visa.step.appointments.medical.title")}:{" "}
          {t(`visa.step.appointments.status.${values.medical_appointment.status}`)}
        </p>
        <p>
          {t("visa.step.appointments.biometric.title")}:{" "}
          {t(
            `visa.step.appointments.status.${values.biometric_appointment.status}`
          )}
        </p>
      </Section>

      <Section
        title={t("visa.step.review.section.address")}
        onEdit={() => onEditStep("address")}
      >
        <p>{values.emirates_id_address.address_line1}</p>
        <p className="text-neutral-500">
          {values.emirates_id_address.city}
          {values.emirates_id_address.emirate
            ? ` · ${values.emirates_id_address.emirate}`
            : ""}
        </p>
      </Section>
    </div>
  );
}
