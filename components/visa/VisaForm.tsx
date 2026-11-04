"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { visaSchema, type VisaFormValues } from "@/lib/visa-schema";
import type { VisaApplication, VisaStepId } from "@/lib/visa-types";
import type { CompanyFile } from "@/lib/company-types";
import { EMIRATES, getVisaFeeLines, getVisaFeeTotal } from "@/lib/visa-constants";
import { createVisaApplication, updateVisaApplication } from "@/app/actions/visa";
import { useActiveSociete } from "@/lib/active-societe";
import VisaTypeField from "./VisaTypeField";
import BranchStep from "./BranchStep";
import VisaDocumentsField from "./VisaDocumentsField";
import AppointmentsStep from "./AppointmentsStep";
import VisaReviewStep from "./VisaReviewStep";
import WizardShell from "../societe/WizardShell";
import { useLanguage } from "../LanguageProvider";

interface VisaFormProps {
  initial?: VisaApplication;
  societes: CompanyFile[];
}

const STEP_FIELDS: Record<VisaStepId, (keyof VisaFormValues)[]> = {
  applicant: ["applicant"],
  type: ["visa_type"],
  branch: ["branch", "company_id"],
  documents: ["documents"],
  appointments: ["medical_appointment", "biometric_appointment"],
  address: ["emirates_id_address"],
  review: [],
  payment: [],
};

const ALL_STEPS: VisaStepId[] = [
  "applicant",
  "type",
  "branch",
  "documents",
  "appointments",
  "address",
  "review",
  "payment",
];

const EMPTY_BRANCH: VisaFormValues["branch"] = {
  role_societe: "",
  pourcentage_participation: null,
  poste: "",
  salaire_mensuel: null,
  type_contrat: "",
  golden_categorie: "",
  golden_duree: "",
  golden_justificatif: "",
  family_lien_sponsor: "",
  sponsor_nom: "",
  sponsor_prenom: "",
  sponsor_id_numero: "",
  dependents: [],
  domestic_poste: "",
  domestic_sponsor_nom: "",
  domestic_foyer_adresse: "",
  domestic_mohre_numero: "",
  remote_employeur_nom: "",
  remote_employeur_pays: "",
  remote_revenu_minimum: null,
  remote_preuve_emploi: "",
};

const EMPTY_APPOINTMENT: VisaFormValues["medical_appointment"] = {
  date: "",
  slot: "",
  center: "",
  status: "a_planifier",
  notified_at: null,
};

const EMPTY_ADDRESS: VisaFormValues["emirates_id_address"] = {
  address_line1: "",
  address_line2: "",
  city: "",
  emirate: "",
  po_box: "",
  phone: "",
};

function defaultValues(initial?: VisaApplication): VisaFormValues {
  if (!initial) {
    return {
      applicant: {
        nom: "",
        prenom: "",
        nationalite: "",
        date_naissance: "",
        numero_passeport: "",
        email: "",
        telephone: "",
      },
      visa_type: "investor",
      company_id: null,
      branch: EMPTY_BRANCH,
      documents: [],
      medical_appointment: EMPTY_APPOINTMENT,
      biometric_appointment: EMPTY_APPOINTMENT,
      emirates_id_address: EMPTY_ADDRESS,
      payment_estimate: { items: [], total: 0 },
    };
  }

  return {
    applicant: initial.applicant,
    visa_type: initial.visa_type,
    company_id: initial.company_id,
    branch: {
      ...EMPTY_BRANCH,
      ...(initial.branch_data as Partial<VisaFormValues["branch"]>),
    },
    documents: initial.documents ?? [],
    medical_appointment: {
      ...EMPTY_APPOINTMENT,
      ...(initial.medical_appointment as Partial<
        VisaFormValues["medical_appointment"]
      >),
    },
    biometric_appointment: {
      ...EMPTY_APPOINTMENT,
      ...(initial.biometric_appointment as Partial<
        VisaFormValues["biometric_appointment"]
      >),
    },
    emirates_id_address: {
      ...EMPTY_ADDRESS,
      ...(initial.emirates_id_address as Partial<
        VisaFormValues["emirates_id_address"]
      >),
    },
    payment_estimate: initial.payment_estimate ?? { items: [], total: 0 },
  };
}

export default function VisaForm({ initial, societes }: VisaFormProps) {
  const router = useRouter();
  const { t, tMessage } = useLanguage();
  const isEditing = Boolean(initial);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState<VisaApplication | null>(null);

  const [stepIndex, setStepIndex] = useState(() =>
    initial ? ALL_STEPS.indexOf("review") : 0
  );
  const [returnToReview, setReturnToReview] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<VisaFormValues>({
    resolver: zodResolver(visaSchema),
    defaultValues: defaultValues(initial),
    mode: "onSubmit",
  });

  const values = watch();
  const visaType = values.visa_type;

  // Small, safe convenience: when creating a brand-new application (no
  // `initial`) and a société is currently active (see lib/active-societe.ts
  // + /choisir-societe), default `company_id` to it for the branches
  // that use it (investor/employee). Applied once, after mount, so it never
  // overrides a value the person already picked and never causes an
  // SSR/client markup mismatch.
  const { activeSociete, mounted } = useActiveSociete();
  useEffect(() => {
    if (!mounted || isEditing || !activeSociete) return;
    if (values.company_id) return;
    if (visaType !== "investor" && visaType !== "employee") return;
    if (!societes.some((s) => s.id === activeSociete.id)) return;
    setValue("company_id", activeSociete.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, activeSociete, isEditing, visaType]);

  const steps = useMemo<VisaStepId[]>(() => ALL_STEPS, []);
  const clampedIndex = Math.min(stepIndex, steps.length - 1);
  const currentStep = steps[clampedIndex];
  const isLastStep = clampedIndex === steps.length - 1;

  function goToStep(step: VisaStepId) {
    const idx = steps.indexOf(step);
    if (idx >= 0) setStepIndex(idx);
  }

  function goToStepFromReview(step: VisaStepId) {
    setReturnToReview(true);
    goToStep(step);
  }

  function onSubmit(formValues: VisaFormValues) {
    setSubmitError(null);
    const feeLines = getVisaFeeLines(formValues.visa_type);
    const feeTotal = getVisaFeeTotal(formValues.visa_type);
    const payload: VisaFormValues = {
      ...formValues,
      payment_estimate: { items: feeLines, total: feeTotal },
    };

    startTransition(async () => {
      const result = initial
        ? await updateVisaApplication(initial.id, payload)
        : await createVisaApplication(payload);

      if (!result.success) {
        setSubmitError(result.error ?? t("visa.wizard.submit.error"));
        return;
      }

      if (result.data) {
        setSubmitted(result.data);
      }
      router.refresh();
    });
  }

  async function handleNext() {
    const fields = STEP_FIELDS[currentStep];
    const valid = fields.length ? await trigger(fields) : true;
    if (!valid) return;

    if (isLastStep) {
      handleSubmit(onSubmit)();
      return;
    }

    if (returnToReview) {
      setReturnToReview(false);
      goToStep("review");
      return;
    }

    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function handleBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  if (submitted) {
    return (
      <div className="grid grid-cols-1 gap-6 rounded-2xl bg-white p-4 sm:p-6 lg:grid-cols-[2fr_3fr] lg:gap-10 lg:p-10">
        <div className="hidden lg:block" />
        <div className="flex w-full max-w-2xl flex-col gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7a9a5a] text-xl font-bold text-white">
            ✓
          </span>
          <h2 className="text-2xl font-extrabold text-neutral-900">
            {t("visa.step.payment.success.title")}
          </h2>
          <p className="text-sm text-neutral-600">
            {t("visa.step.payment.success.body")}
          </p>
          <p className="rounded-xl bg-neutral-100 px-4 py-3 font-mono text-sm font-bold text-neutral-900">
            {submitted.tracking_reference}
          </p>
          <button
            type="button"
            onClick={() => router.push("/administration/visas")}
            className="w-full rounded-full bg-[#7a9a5a] px-6 py-3.5 text-center text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 sm:w-auto"
          >
            {t("visa.step.payment.success.backToList")}
          </button>
        </div>
      </div>
    );
  }

  const nextLabel = isLastStep
    ? isEditing
      ? t("visa.step.payment.confirm.edit")
      : t("visa.step.payment.confirm.create")
    : t("wizard.next");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleNext();
      }}
      className="flex flex-col gap-4"
    >
      {submitError && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
          {submitError}
        </div>
      )}

      <WizardShell
        title={t(`visa.step.${currentStep}.title`)}
        subtitle={t(`visa.step.${currentStep}.subtitle`)}
        onBack={clampedIndex > 0 ? handleBack : undefined}
        onCancel={() => router.push("/administration/visas")}
        stepIndex={clampedIndex}
        stepCount={steps.length}
        illustrationChip1Key="visa.wizard.illustration.chip1"
        illustrationTitleKey="visa.wizard.illustration.title"
        illustrationBodyKey="visa.wizard.illustration.body"
        footer={
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-full bg-[#7a9a5a] px-6 py-3.5 text-center text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
          >
            {isPending ? t("wizard.submitting") : nextLabel}
          </button>
        }
      >
        {currentStep === "applicant" && (
          <div className="flex flex-col gap-4">
            {(
              [
                ["nom", "visa.step.applicant.field.lastname", "text"],
                ["prenom", "visa.step.applicant.field.firstname", "text"],
                ["nationalite", "visa.step.applicant.field.nationality", "text"],
                ["date_naissance", "visa.step.applicant.field.birthdate", "date"],
                [
                  "numero_passeport",
                  "visa.step.applicant.field.passport",
                  "text",
                ],
                ["email", "visa.step.applicant.field.email", "email"],
                ["telephone", "visa.step.applicant.field.phone", "tel"],
              ] as const
            ).map(([field, labelKey, type]) => (
              <div key={field} className="flex flex-col gap-1.5">
                <label
                  htmlFor={`applicant-${field}`}
                  className="text-sm font-medium text-neutral-600"
                >
                  {t(labelKey)}
                </label>
                <input
                  id={`applicant-${field}`}
                  type={type}
                  {...register(`applicant.${field}`)}
                  className="w-full max-w-md rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
                />
                {errors.applicant?.[field]?.message && (
                  <p className="text-sm text-red-500">
                    {tMessage(errors.applicant[field]?.message)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {currentStep === "type" && (
          <Controller
            control={control}
            name="visa_type"
            render={({ field }) => (
              <VisaTypeField
                value={field.value}
                onChange={field.onChange}
                error={errors.visa_type?.message}
              />
            )}
          />
        )}

        {currentStep === "branch" && (
          <BranchStep
            control={control}
            register={register}
            errors={errors}
            visaType={visaType}
            linkedSocieteId={values.company_id}
            onLinkedSocieteChange={(id) =>
              setValue("company_id", id, { shouldValidate: true })
            }
            societes={societes}
          />
        )}

        {currentStep === "documents" && (
          <VisaDocumentsField
            value={values.documents}
            onChange={(docs) => setValue("documents", docs)}
            visaType={visaType}
          />
        )}

        {currentStep === "appointments" && (
          <AppointmentsStep
            register={register}
            medical={values.medical_appointment}
            biometric={values.biometric_appointment}
            onStatusChange={(kind, status, notifiedAt) => {
              const key =
                kind === "medical" ? "medical_appointment" : "biometric_appointment";
              setValue(`${key}.status`, status);
              setValue(`${key}.notified_at`, notifiedAt);
            }}
          />
        )}

        {currentStep === "address" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-600">
                {t("visa.step.address.field.line1")}
              </label>
              <input
                {...register("emirates_id_address.address_line1")}
                className="w-full max-w-md rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
              />
              {errors.emirates_id_address?.address_line1?.message && (
                <p className="text-sm text-red-500">
                  {tMessage(errors.emirates_id_address.address_line1.message)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-600">
                {t("visa.step.address.field.line2")}
              </label>
              <input
                {...register("emirates_id_address.address_line2")}
                className="w-full max-w-md rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-600">
                  {t("visa.step.address.field.city")}
                </label>
                <input
                  {...register("emirates_id_address.city")}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
                />
                {errors.emirates_id_address?.city?.message && (
                  <p className="text-sm text-red-500">
                    {tMessage(errors.emirates_id_address.city.message)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-600">
                  {t("visa.step.address.field.emirate")}
                </label>
                <select
                  {...register("emirates_id_address.emirate")}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
                >
                  <option value="" disabled>
                    {t("visa.step.address.field.emirate")}
                  </option>
                  {EMIRATES.map((em) => (
                    <option key={em} value={em}>
                      {em}
                    </option>
                  ))}
                </select>
                {errors.emirates_id_address?.emirate?.message && (
                  <p className="text-sm text-red-500">
                    {tMessage(errors.emirates_id_address.emirate.message)}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-600">
                  {t("visa.step.address.field.pobox")}
                </label>
                <input
                  {...register("emirates_id_address.po_box")}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-600">
                  {t("visa.step.address.field.phone")}
                </label>
                <input
                  type="tel"
                  {...register("emirates_id_address.phone")}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
                />
                {errors.emirates_id_address?.phone?.message && (
                  <p className="text-sm text-red-500">
                    {tMessage(errors.emirates_id_address.phone.message)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {currentStep === "review" && (
          <VisaReviewStep
            values={values}
            onEditStep={goToStepFromReview}
            societes={societes}
          />
        )}

        {currentStep === "payment" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <ul className="flex flex-col divide-y divide-neutral-200">
                {getVisaFeeLines(visaType).map((line) => (
                  <li
                    key={line.key}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-neutral-700">
                      {t(`visa.fee.${line.key}`)}
                    </span>
                    <span className="font-semibold text-neutral-900">
                      {line.amount.toLocaleString()} AED
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-3">
                <span className="text-sm font-bold text-neutral-900">
                  {t("visa.step.payment.total")}
                </span>
                <span className="text-base font-extrabold text-neutral-900">
                  {getVisaFeeTotal(visaType).toLocaleString()} AED
                </span>
              </div>
            </div>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {t("visa.step.payment.disclaimer")}
            </p>
          </div>
        )}
      </WizardShell>
    </form>
  );
}
