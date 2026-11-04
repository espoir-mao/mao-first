"use client";

import { useMemo, useRef, useState } from "react";
import type { CompanyCatalog, CompanyFile, LeaseMode } from "@/lib/company-types";
import { formatAed } from "@/lib/company-view";
import { documentChecklist, type ChecklistItem } from "@/lib/company-domain";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { ALLOWED_DOCUMENT_TYPES, DOCUMENTS_BUCKET, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/storage";
import { recordCompanyDocument, removeCompanyDocument, saveCompanyLease } from "@/app/actions/companies";
import { FileIcon, UploadIcon } from "../Icons";
import { useLanguage } from "../LanguageProvider";
import { smallPrimaryButtonClass, secondaryButtonClass } from "./ui";

interface StepDocumentsProps {
  company: CompanyFile;
  catalog: CompanyCatalog;
  onUpdated: (company: CompanyFile) => void;
}

/**
 * Step 8 — documents. The list depends on the guichet, the legal form and the
 * chosen activities (CV / diploma for regulated professions), and is asked per
 * holder: passport, photo and proof of address for each person; legalised
 * parent-company documents for a company shareholder.
 */
export default function StepDocuments({ company, catalog, onUpdated }: StepDocumentsProps) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const checklist = useMemo(
    () =>
      documentChecklist(
        company.authority_id as string,
        company.legal_form_id as string,
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
      ),
    [company, catalog.requiredDocuments]
  );

  function holderName(id: string | null): string {
    if (!id) return t("company.docs.forCompany");
    const s = company.shareholders.find((x) => x.id === id);
    if (!s) return "";
    return s.person ? `${s.person.first_name} ${s.person.last_name}` : s.parent_company?.name ?? "";
  }

  function rowKey(item: ChecklistItem): string {
    return `${item.required_document_id}:${item.shareholder_id ?? "-"}`;
  }

  async function upload(item: ChecklistItem, file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!isSupabaseConfigured()) {
      setError(t("step.documents.error.config"));
      return;
    }
    if (ALLOWED_DOCUMENT_TYPES.indexOf(file.type) === -1) {
      setError(t("step.documents.error.type", { name: file.name }));
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setError(t("step.documents.error.size", { name: file.name }));
      return;
    }
    const key = rowKey(item);
    setBusy(key);
    try {
      const supabase = getSupabaseClient();
      const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${company.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const up = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, { upsert: false });
      if (up.error) {
        setError(t("step.documents.error.upload", { name: file.name, error: up.error.message }));
        return;
      }
      const { data: pub } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
      const result = await recordCompanyDocument(company.id, {
        required_document_id: item.required_document_id,
        shareholder_id: item.shareholder_id,
        file_url: pub.publicUrl,
        file_name: file.name,
        file_size: file.size,
      });
      if (!result.success || !result.data) {
        setError(result.error ?? t("company.docs.error"));
        return;
      }
      onUpdated(result.data);
    } catch (err) {
      setError(t("step.documents.error.upload", { name: file.name, error: err instanceof Error ? err.message : "" }));
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: ChecklistItem) {
    const doc = company.documents.find(
      (d) => d.required_document_id === item.required_document_id && d.shareholder_id === item.shareholder_id
    );
    if (!doc) return;
    setError(null);
    setBusy(rowKey(item));
    const result = await removeCompanyDocument(company.id, doc.id);
    setBusy(null);
    if (!result.success || !result.data) {
      setError(result.error ?? t("company.docs.error"));
      return;
    }
    onUpdated(result.data);
  }

  const missing = checklist.filter((i) => !i.provided && !i.optional).length;
  const mainland = company.jurisdiction_type === "MAINLAND";
  const officePrice =
    catalog.officeOptions.find(
      (o) => o.authority_id === company.authority_id && o.office_type_id === company.office_type_id
    )?.annual_price_aed ?? null;

  async function chooseLease(mode: LeaseMode) {
    if (company.lease_mode === mode) return;
    setError(null);
    setBusy("lease");
    const result = await saveCompanyLease(company.id, mode);
    setBusy(null);
    if (!result.success || !result.data) {
      setError(result.error ?? t("company.docs.error"));
      return;
    }
    onUpdated(result.data);
  }

  return (
    <div className="flex flex-col gap-3">
      {mainland && (
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3">
          <div>
            <p className="text-sm font-bold text-neutral-800">{t("company.lease.title")}</p>
            <p className="text-xs text-neutral-500">{t("company.lease.help")}</p>
          </div>
          {(["OWN", "MAO"] as LeaseMode[]).map((mode) => (
            <label
              key={mode}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                company.lease_mode === mode
                  ? "border-[#7a9a5a] bg-spring-50 text-[#3f5029]"
                  : "border-neutral-200 text-neutral-700"
              }`}
            >
              <input
                type="radio"
                name="lease_mode"
                className="mt-0.5"
                checked={company.lease_mode === mode}
                disabled={busy === "lease"}
                onChange={() => void chooseLease(mode)}
              />
              <span>
                <span className="font-bold">{t(`company.lease.${mode}`)}</span>
                <span className="block text-xs">
                  {mode === "OWN"
                    ? t("company.lease.OWN.desc")
                    : t("company.lease.MAO.desc", { price: officePrice === null ? "—" : formatAed(officePrice) })}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      <p className={`text-sm font-semibold ${missing === 0 ? "text-emerald-700" : "text-amber-700"}`}>
        {missing === 0 ? t("company.docs.complete") : t("company.docs.missing", { n: missing })}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200">
        {checklist.map((item) => {
          const key = rowKey(item);
          const doc = company.documents.find(
            (d) => d.required_document_id === item.required_document_id && d.shareholder_id === item.shareholder_id
          );
          return (
            <div key={key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-neutral-800">
                  {item.label}
                  {item.optional && (
                    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                      {t("company.docs.optional")}
                    </span>
                  )}
                </span>
                <span className="text-xs text-neutral-500">{holderName(item.shareholder_id)}</span>
                {doc && (
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1.5 truncate text-xs text-[#4a5f34] hover:underline">
                    <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    {doc.file_name || doc.file_url}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={(el) => {
                    inputs.current[key] = el;
                  }}
                  type="file"
                  accept={ALLOWED_DOCUMENT_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    void upload(item, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button type="button" disabled={busy === key} onClick={() => inputs.current[key]?.click()} className={`${smallPrimaryButtonClass} flex items-center gap-1.5`}>
                  <UploadIcon className="h-3.5 w-3.5" />
                  {busy === key ? t("company.docs.uploading") : item.provided ? t("company.docs.replace") : t("company.docs.upload")}
                </button>
                {item.provided && (
                  <button type="button" disabled={busy === key} onClick={() => void remove(item)} className={secondaryButtonClass}>
                    {t("company.docs.remove")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
