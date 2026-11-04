"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CompanyFile } from "@/lib/company-types";
import { companyDisplayName } from "@/lib/company-view";
import { deleteCompanyDraft } from "@/app/actions/companies";
import SocieteRow from "./SocieteRow";
import { PlusIcon } from "../Icons";
import { useLanguage } from "../LanguageProvider";

interface SocieteManagerProps {
  initialSocietes: CompanyFile[];
  configured: boolean;
  loadError?: string;
}

export default function SocieteManager({
  initialSocietes,
  configured,
  loadError,
}: SocieteManagerProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [societes, setSocietes] = useState<CompanyFile[]>(initialSocietes);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!configured) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-neutral-800 sm:p-8">
        <h2 className="text-lg font-bold">{t("list.config.title")}</h2>
        <p className="mt-2 text-sm text-neutral-600">{t("list.config.body")}</p>
      </div>
    );
  }

  async function handleDelete(societe: CompanyFile) {
    setError(null);
    const confirmed = window.confirm(
      t("list.delete.confirm", {
        name: companyDisplayName(societe) ?? t("company.draft.untitled"),
      })
    );
    if (!confirmed) return;

    setPendingId(societe.id);
    startTransition(async () => {
      const result = await deleteCompanyDraft(societe.id);
      setPendingId(null);
      if (!result.success) {
        setError(result.error ?? t("list.delete.error"));
        return;
      }
      setSocietes((prev) => prev.filter((s) => s.id !== societe.id));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {societes.length === 0 ? (
        <div className="rounded-2xl border border-neutral-100 bg-white p-8 text-center text-neutral-800">
          <p className="text-lg font-bold">{t("list.empty.title")}</p>
          <p className="mt-2 text-sm text-neutral-500">
            {t("list.empty.subtitle")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-100">
          {societes.map((societe) => (
            <SocieteRow
              key={societe.id}
              societe={societe}
              onDelete={() => handleDelete(societe)}
              disabled={isPending && pendingId === societe.id}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/societes/nouvelle")}
        className="flex items-center justify-center gap-2 rounded-full bg-[#7a9a5a] px-6 py-3.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95"
      >
        {t("list.create")} <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
