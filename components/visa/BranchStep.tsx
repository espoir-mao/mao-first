"use client";

import {
  Controller,
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import type { VisaFormValues } from "@/lib/visa-schema";
import type { VisaType } from "@/lib/visa-constants";
import {
  CONTRACT_TYPES,
  GOLDEN_CATEGORIES,
  GOLDEN_DURATIONS,
  FAMILY_RELATIONS,
  DOMESTIC_JOB_TYPES,
} from "@/lib/visa-constants";
import type { CompanyFile } from "@/lib/company-types";
import { PlusIcon, TrashIcon } from "../Icons";
import { useLanguage } from "../LanguageProvider";
import { companyDisplayName } from "@/lib/company-view";

interface BranchStepProps {
  control: Control<VisaFormValues>;
  register: UseFormRegister<VisaFormValues>;
  errors: FieldErrors<VisaFormValues>;
  visaType: VisaType;
  linkedSocieteId: string | null | undefined;
  onLinkedSocieteChange: (id: string) => void;
  societes: CompanyFile[];
}

function FieldWrap({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const { tMessage } = useLanguage();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-neutral-600">{label}</label>
      {children}
      {error && <p className="text-sm text-red-500">{tMessage(error)}</p>}
    </div>
  );
}

const inputClass =
  "w-full max-w-md rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-[#7a9a5a]";

export default function BranchStep({
  control,
  register,
  errors,
  visaType,
  linkedSocieteId,
  onLinkedSocieteChange,
  societes,
}: BranchStepProps) {
  const { t, tOption } = useLanguage();
  const branchErrors = errors.branch as
    | Record<string, { message?: string } | undefined>
    | undefined;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "branch.dependents",
  });

  if (visaType === "investor" || visaType === "employee") {
    const label =
      visaType === "investor"
        ? t("visa.step.branch.investor.societe.label")
        : t("visa.step.branch.employee.societe.label");

    return (
      <div className="flex flex-col gap-4">
        <FieldWrap label={label} error={errors.company_id?.message}>
          {societes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
              {t("visa.step.branch.investor.societe.empty")}
            </p>
          ) : (
            <select
              value={linkedSocieteId ?? ""}
              onChange={(e) => onLinkedSocieteChange(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                {t("visa.step.branch.investor.societe.placeholder")}
              </option>
              {societes.map((s) => (
                <option key={s.id} value={s.id}>
                  {companyDisplayName(s) ?? s.id}
                </option>
              ))}
            </select>
          )}
        </FieldWrap>

        {visaType === "investor" ? (
          <>
            <FieldWrap
              label={t("visa.step.branch.investor.role.label")}
              error={branchErrors?.role_societe?.message}
            >
              <input
                {...register("branch.role_societe")}
                className={inputClass}
              />
            </FieldWrap>
            <FieldWrap
              label={t("visa.step.branch.investor.percentage.label")}
              error={branchErrors?.pourcentage_participation?.message}
            >
              <Controller
                control={control}
                name="branch.pourcentage_participation"
                render={({ field }) => (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    className={inputClass}
                  />
                )}
              />
            </FieldWrap>
          </>
        ) : (
          <>
            <FieldWrap
              label={t("visa.step.branch.employee.poste.label")}
              error={branchErrors?.poste?.message}
            >
              <input {...register("branch.poste")} className={inputClass} />
            </FieldWrap>
            <FieldWrap
              label={t("visa.step.branch.employee.salaire.label")}
              error={branchErrors?.salaire_mensuel?.message}
            >
              <Controller
                control={control}
                name="branch.salaire_mensuel"
                render={({ field }) => (
                  <input
                    type="number"
                    min={0}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    className={inputClass}
                  />
                )}
              />
            </FieldWrap>
            <FieldWrap
              label={t("visa.step.branch.employee.contrat.label")}
              error={branchErrors?.type_contrat?.message}
            >
              <select {...register("branch.type_contrat")} className={inputClass}>
                <option value="" disabled>
                  {t("visa.step.branch.employee.contrat.label")}
                </option>
                {CONTRACT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {tOption("visa.contract", c)}
                  </option>
                ))}
              </select>
            </FieldWrap>
          </>
        )}
      </div>
    );
  }

  if (visaType === "golden") {
    return (
      <div className="flex flex-col gap-4">
        <FieldWrap
          label={t("visa.step.branch.golden.categorie.label")}
          error={branchErrors?.golden_categorie?.message}
        >
          <select {...register("branch.golden_categorie")} className={inputClass}>
            <option value="" disabled>
              {t("visa.step.branch.golden.categorie.label")}
            </option>
            {GOLDEN_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tOption("visa.golden", c)}
              </option>
            ))}
          </select>
        </FieldWrap>
        <FieldWrap
          label={t("visa.step.branch.golden.duree.label")}
          error={branchErrors?.golden_duree?.message}
        >
          <select {...register("branch.golden_duree")} className={inputClass}>
            <option value="" disabled>
              {t("visa.step.branch.golden.duree.label")}
            </option>
            {GOLDEN_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {tOption("visa.golden.duree", d)}
              </option>
            ))}
          </select>
        </FieldWrap>
        <FieldWrap
          label={t("visa.step.branch.golden.justificatif.label")}
          error={branchErrors?.golden_justificatif?.message}
        >
          <textarea
            rows={4}
            {...register("branch.golden_justificatif")}
            placeholder={t("visa.step.branch.golden.justificatif.placeholder")}
            className={inputClass}
          />
        </FieldWrap>
      </div>
    );
  }

  if (visaType === "family") {
    const depErrors = branchErrors?.dependents as
      | (Record<string, { message?: string } | undefined>[] & {
          message?: string;
        })
      | undefined;

    return (
      <div className="flex flex-col gap-5">
        <FieldWrap
          label={t("visa.step.branch.family.lien.label")}
          error={branchErrors?.family_lien_sponsor?.message}
        >
          <select
            {...register("branch.family_lien_sponsor")}
            className={inputClass}
          >
            <option value="" disabled>
              {t("visa.step.branch.family.lien.label")}
            </option>
            {FAMILY_RELATIONS.map((r) => (
              <option key={r} value={r}>
                {tOption("visa.family.lien", r)}
              </option>
            ))}
          </select>
        </FieldWrap>

        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            {t("visa.step.branch.family.sponsor.title")}
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldWrap
              label={t("visa.step.branch.family.sponsor.nom.label")}
              error={branchErrors?.sponsor_nom?.message}
            >
              <input {...register("branch.sponsor_nom")} className={inputClass} />
            </FieldWrap>
            <FieldWrap
              label={t("visa.step.branch.family.sponsor.prenom.label")}
              error={branchErrors?.sponsor_prenom?.message}
            >
              <input
                {...register("branch.sponsor_prenom")}
                className={inputClass}
              />
            </FieldWrap>
            <FieldWrap
              label={t("visa.step.branch.family.sponsor.id.label")}
              error={branchErrors?.sponsor_id_numero?.message}
            >
              <input
                {...register("branch.sponsor_id_numero")}
                className={inputClass}
              />
            </FieldWrap>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-bold text-neutral-900">
              {t("visa.step.branch.family.dependents.title")}
            </p>
            <p className="text-xs text-neutral-500">
              {t("visa.step.branch.family.dependents.subtitle")}
            </p>
          </div>

          {fields.length === 0 && (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
              {t("visa.step.branch.family.dependents.empty")}
            </p>
          )}

          {depErrors?.message && (
            <p className="text-sm text-red-500">{depErrors.message}</p>
          )}

          <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                    {t("visa.step.branch.family.dependents.item", {
                      n: index + 1,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={t(
                      "visa.step.branch.family.dependents.remove.aria",
                      { n: index + 1 }
                    )}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Controller
                    control={control}
                    name={`branch.dependents.${index}.prenom`}
                    render={({ field: f }) => (
                      <FieldWrap
                        label={t(
                          "visa.step.branch.family.dependents.field.firstname"
                        )}
                        error={depErrors?.[index]?.prenom?.message}
                      >
                        <input {...f} className={inputClass} />
                      </FieldWrap>
                    )}
                  />
                  <Controller
                    control={control}
                    name={`branch.dependents.${index}.nom`}
                    render={({ field: f }) => (
                      <FieldWrap
                        label={t(
                          "visa.step.branch.family.dependents.field.lastname"
                        )}
                        error={depErrors?.[index]?.nom?.message}
                      >
                        <input {...f} className={inputClass} />
                      </FieldWrap>
                    )}
                  />
                  <Controller
                    control={control}
                    name={`branch.dependents.${index}.lien`}
                    render={({ field: f }) => (
                      <FieldWrap
                        label={t(
                          "visa.step.branch.family.dependents.field.relation"
                        )}
                        error={depErrors?.[index]?.lien?.message}
                      >
                        <input {...f} className={inputClass} />
                      </FieldWrap>
                    )}
                  />
                  <Controller
                    control={control}
                    name={`branch.dependents.${index}.date_naissance`}
                    render={({ field: f }) => (
                      <FieldWrap
                        label={t(
                          "visa.step.branch.family.dependents.field.birthdate"
                        )}
                        error={depErrors?.[index]?.date_naissance?.message}
                      >
                        <input type="date" {...f} className={inputClass} />
                      </FieldWrap>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              append({ nom: "", prenom: "", lien: "", date_naissance: "" })
            }
            className="flex items-center justify-center gap-2 self-start rounded-full border border-[#7a9a5a]/40 bg-[#7a9a5a]/10 px-4 py-2 text-xs font-bold text-[#4a5f34] transition hover:bg-[#7a9a5a]/20"
          >
            {t("visa.step.branch.family.dependents.add")}{" "}
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (visaType === "domestic") {
    return (
      <div className="flex flex-col gap-4">
        <FieldWrap
          label={t("visa.step.branch.domestic.poste.label")}
          error={branchErrors?.domestic_poste?.message}
        >
          <select {...register("branch.domestic_poste")} className={inputClass}>
            <option value="" disabled>
              {t("visa.step.branch.domestic.poste.label")}
            </option>
            {DOMESTIC_JOB_TYPES.map((j) => (
              <option key={j} value={j}>
                {tOption("visa.domestic", j)}
              </option>
            ))}
          </select>
        </FieldWrap>
        <FieldWrap
          label={t("visa.step.branch.domestic.sponsor.label")}
          error={branchErrors?.domestic_sponsor_nom?.message}
        >
          <input
            {...register("branch.domestic_sponsor_nom")}
            className={inputClass}
          />
        </FieldWrap>
        <FieldWrap
          label={t("visa.step.branch.domestic.adresse.label")}
          error={branchErrors?.domestic_foyer_adresse?.message}
        >
          <input
            {...register("branch.domestic_foyer_adresse")}
            className={inputClass}
          />
        </FieldWrap>
        <FieldWrap label={t("visa.step.branch.domestic.mohre.label")}>
          <input
            {...register("branch.domestic_mohre_numero")}
            className={inputClass}
          />
        </FieldWrap>
      </div>
    );
  }

  // remote
  return (
    <div className="flex flex-col gap-4">
      <FieldWrap
        label={t("visa.step.branch.remote.employeur.label")}
        error={branchErrors?.remote_employeur_nom?.message}
      >
        <input
          {...register("branch.remote_employeur_nom")}
          className={inputClass}
        />
      </FieldWrap>
      <FieldWrap
        label={t("visa.step.branch.remote.pays.label")}
        error={branchErrors?.remote_employeur_pays?.message}
      >
        <input
          {...register("branch.remote_employeur_pays")}
          className={inputClass}
        />
      </FieldWrap>
      <FieldWrap
        label={t("visa.step.branch.remote.revenu.label")}
        error={branchErrors?.remote_revenu_minimum?.message}
      >
        <Controller
          control={control}
          name="branch.remote_revenu_minimum"
          render={({ field }) => (
            <input
              type="number"
              min={0}
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              className={inputClass}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap
        label={t("visa.step.branch.remote.preuve.label")}
        error={branchErrors?.remote_preuve_emploi?.message}
      >
        <textarea
          rows={3}
          {...register("branch.remote_preuve_emploi")}
          placeholder={t("visa.step.branch.remote.preuve.placeholder")}
          className={inputClass}
        />
      </FieldWrap>
    </div>
  );
}
