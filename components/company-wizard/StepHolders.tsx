"use client";

import { useMemo, useState, useTransition } from "react";
import type { ClientChoice, CompanyFile, LegalForm } from "@/lib/company-types";
import { validateShareholders } from "@/lib/company-domain";
import { firstIssueMessage, issueMessage } from "@/lib/issue-text";
import type { HolderInput } from "@/lib/company-schema";
import {
  saveCompanyHolders,
} from "@/app/actions/companies";
import { PlusIcon, TrashIcon } from "../Icons";
import { useLanguage } from "../LanguageProvider";
import CountrySelect from "./CountrySelect";
import { inputClass, labelClass, secondaryButtonClass, smallPrimaryButtonClass } from "./ui";

export interface HolderDraft {
  key: string;
  id?: string;
  kind: "PERSON" | "PARENT_COMPANY";
  share: string;
  is_manager: boolean;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  nationality: string;
  passport_number: string;
  birth_date: string;
  pc_name: string;
  pc_country: string;
  pc_reg: string;
}

let counter = 0;
function newKey(): string {
  counter += 1;
  return `h${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyHolder(kind: HolderDraft["kind"] = "PERSON", share = "", manager = false): HolderDraft {
  return {
    key: newKey(),
    kind,
    share,
    is_manager: manager,
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    nationality: "",
    passport_number: "",
    birth_date: "",
    pc_name: "",
    pc_country: "",
    pc_reg: "",
  };
}

export function draftsFromCompany(company: CompanyFile, choice: ClientChoice | null): HolderDraft[] {
  if (company.shareholders.length > 0) {
    return company.shareholders.map((s) => ({
      ...emptyHolder(s.person_id ? "PERSON" : "PARENT_COMPANY", String(Number(s.share_pct)), s.is_manager),
      id: s.id,
      first_name: s.person?.first_name ?? "",
      last_name: s.person?.last_name ?? "",
      email: s.person?.email ?? "",
      phone: s.person?.phone ?? "",
      nationality: s.person?.nationality ?? "",
      passport_number: s.person?.passport_number ?? "",
      birth_date: s.person?.birth_date ?? "",
      pc_name: s.parent_company?.name ?? "",
      pc_country: s.parent_company?.country ?? "",
      pc_reg: s.parent_company?.registration_number ?? "",
    }));
  }
  if (choice === "MULTI") return [emptyHolder("PERSON", "50", true), emptyHolder("PERSON", "50")];
  return [emptyHolder("PERSON", "100", true)];
}

export function holderInputOf(h: HolderDraft): HolderInput {
  return {
    id: h.id ?? null,
    kind: h.kind,
    share_pct: parseFloat(h.share.replace(",", ".")) || 0,
    is_manager: h.is_manager,
    person:
      h.kind === "PERSON"
        ? {
            first_name: h.first_name,
            last_name: h.last_name,
            email: h.email,
            phone: h.phone,
            nationality: h.nationality,
            passport_number: h.passport_number,
            birth_date: h.birth_date,
          }
        : null,
    parent_company:
      h.kind === "PARENT_COMPANY"
        ? { name: h.pc_name, country: h.pc_country, registration_number: h.pc_reg }
        : null,
  };
}

interface StepHoldersProps {
  company: CompanyFile;
  legalForm: LegalForm;
  drafts: HolderDraft[];
  setDrafts: (d: HolderDraft[]) => void;
  savedSignature: string | null;
  onSaved: (company: CompanyFile, signature: string) => void;
  onCompanyUpdated: (company: CompanyFile) => void;
}

export function holdersSignature(drafts: HolderDraft[]): string {
  return JSON.stringify(drafts.map((d) => ({ ...d, key: undefined })));
}

/**
 * Step 7 — shareholders and manager. The identity check (KYC, Sumsub — simulated
 * in this demo) is NOT done here: the MAO team runs it during its review, in
 * Backoffice MAO. A shareholder that is itself a company needs its (legalised)
 * parent-company documents on the next screen.
 */
export default function StepHolders({
  company,
  legalForm,
  drafts,
  setDrafts,
  savedSignature,
  onSaved,
  onCompanyUpdated,
}: StepHoldersProps) {
  const { t, tMessage } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const choice = company.client_choice as ClientChoice;
  const signature = holdersSignature(drafts);
  const dirty = signature !== savedSignature;
  const canAddCompany = choice === "MULTI";
  const canAddHolder = choice === "MULTI" && (legalForm.max_shareholders === null || drafts.length < legalForm.max_shareholders);

  const issues = useMemo(
    () =>
      validateShareholders(
        choice,
        legalForm,
        drafts.map((d) => ({
          isPerson: d.kind === "PERSON",
          sharePct: parseFloat(d.share.replace(",", ".")) || 0,
          isManager: d.is_manager,
        }))
      ),
    [choice, legalForm, drafts]
  );
  const total = drafts.reduce((s, d) => s + (parseFloat(d.share.replace(",", ".")) || 0), 0);

  function update(key: string, patch: Partial<HolderDraft>) {
    setDrafts(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function setManager(key: string) {
    setDrafts(drafts.map((d) => ({ ...d, is_manager: d.key === key })));
  }

  function remove(key: string) {
    const left = drafts.filter((d) => d.key !== key);
    if (left.length > 0 && !left.some((d) => d.is_manager)) {
      const firstPerson = left.find((d) => d.kind === "PERSON");
      if (firstPerson) firstPerson.is_manager = true;
    }
    setDrafts(left);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveCompanyHolders(company.id, drafts.map(holderInputOf));
      if (!result.success || !result.data) {
        setError(tMessage(firstIssueMessage(t, result, t("company.holders.error"))) ?? t("company.holders.error"));
        return;
      }
      // rebuild from the server rows so later edits update in place (documents survive)
      const rebuilt = draftsFromCompany(result.data, choice);
      setDrafts(rebuilt);
      onSaved(result.data, holdersSignature(rebuilt));
    });
  }


  return (
    <div className="flex flex-col gap-4">
      {drafts.map((d, index) => (
        <div key={d.key} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              {d.kind === "PERSON"
                ? t("company.holders.person", { n: index + 1 })
                : t("company.holders.company", { n: index + 1 })}
            </span>
            {drafts.length > 1 && (
              <button
                type="button"
                onClick={() => remove(d.key)}
                aria-label={t("step.shareholders.remove.aria", { n: index + 1 })}
                className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {d.kind === "PERSON" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("step.shareholders.field.firstname")}>
                <input className={inputClass} value={d.first_name} onChange={(e) => update(d.key, { first_name: e.target.value })} />
              </Field>
              <Field label={t("step.shareholders.field.lastname")}>
                <input className={inputClass} value={d.last_name} onChange={(e) => update(d.key, { last_name: e.target.value })} />
              </Field>
              <Field label={t("step.shareholders.field.email")}>
                <input type="email" className={inputClass} value={d.email} onChange={(e) => update(d.key, { email: e.target.value })} />
              </Field>
              <Field label={t("step.shareholders.field.phone")}>
                <input className={inputClass} value={d.phone} onChange={(e) => update(d.key, { phone: e.target.value })} />
              </Field>
              <Field label={t("company.holders.nationality")}>
                <CountrySelect value={d.nationality} onChange={(v) => update(d.key, { nationality: v })} />
              </Field>
              <Field label={t("company.holders.passport")}>
                <input className={inputClass} value={d.passport_number} onChange={(e) => update(d.key, { passport_number: e.target.value })} />
              </Field>
              <Field label={t("company.holders.birthDate")}>
                <input type="date" className={inputClass} value={d.birth_date} onChange={(e) => update(d.key, { birth_date: e.target.value })} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("company.holders.pc.name")}>
                <input className={inputClass} value={d.pc_name} onChange={(e) => update(d.key, { pc_name: e.target.value })} />
              </Field>
              <Field label={t("company.holders.pc.country")}>
                <CountrySelect value={d.pc_country} onChange={(v) => update(d.key, { pc_country: v })} />
              </Field>
              <Field label={t("company.holders.pc.registration")}>
                <input className={inputClass} value={d.pc_reg} onChange={(e) => update(d.key, { pc_reg: e.target.value })} />
              </Field>
              <p className="text-xs text-neutral-500 sm:col-span-2">{t("company.holders.pc.docsNote")}</p>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4">
            <Field label={t("company.holders.share")}>
              <input
                inputMode="decimal"
                className={`${inputClass} w-28`}
                value={d.share}
                onChange={(e) => update(d.key, { share: e.target.value })}
                disabled={drafts.length === 1}
              />
            </Field>
            {d.kind === "PERSON" && (
              <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700">
                <input type="radio" name="manager" checked={d.is_manager} onChange={() => setManager(d.key)} />
                {t("company.holder.manager")}
              </label>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {canAddHolder && (
          <button type="button" onClick={() => setDrafts([...drafts, emptyHolder("PERSON")])} className={`${secondaryButtonClass} flex items-center gap-1.5`}>
            <PlusIcon className="h-3.5 w-3.5" /> {t("company.holders.addPerson")}
          </button>
        )}
        {canAddCompany && canAddHolder && (
          <button type="button" onClick={() => setDrafts([...drafts, emptyHolder("PARENT_COMPANY")])} className={`${secondaryButtonClass} flex items-center gap-1.5`}>
            <PlusIcon className="h-3.5 w-3.5" /> {t("company.holders.addCompany")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={Math.round(total * 100) === 10000 ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
          {t("company.holders.total", { total: Math.round(total * 100) / 100 })}
        </span>
        <span className="text-xs text-neutral-500">
          {t("company.holders.legalForm", {
            form: legalForm.label,
            min: legalForm.min_shareholders,
            max: legalForm.max_shareholders ?? "∞",
          })}
        </span>
      </div>

      {issues.length > 0 && (
        <ul className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          {issues.map((i) => (
            <li key={i.code}>• {issueMessage(t, i)}</li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="button" onClick={save} disabled={isPending || issues.length > 0 || !dirty} className={`${smallPrimaryButtonClass} w-fit`}>
        {isPending ? t("company.holders.saving") : dirty ? t("company.holders.save") : t("company.holders.saved")}
      </button>

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}
