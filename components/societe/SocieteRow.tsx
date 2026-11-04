"use client";

import { useRouter } from "next/navigation";
import type { CompanyFile } from "@/lib/company-types";
import { companyDisplayName, companyHref, statusBadgeClasses } from "@/lib/company-view";
import { PencilIcon, TrashIcon } from "../Icons";
import { useLanguage } from "../LanguageProvider";

interface SocieteRowProps {
  societe: CompanyFile;
  onDelete: () => void;
  disabled?: boolean;
}

export default function SocieteRow({ societe, onDelete, disabled }: SocieteRowProps) {
  const router = useRouter();
  const { t, tEmirate } = useLanguage();
  const name = companyDisplayName(societe) ?? t("company.draft.untitled");
  const shareholderCount = societe.shareholders.length;
  const isDraft = societe.status === "DRAFT";

  return (
    <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate text-base font-semibold text-neutral-900">{name}</p>
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
          <span
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadgeClasses(
              societe.status
            )}`}
          >
            {t(`status.${societe.status}`)}
          </span>
          {societe.jurisdiction_type && (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-spring-200 px-2 py-0.5 text-[11px] font-bold text-[#3f5029]">
              {t(`jurisdiction.${societe.jurisdiction_type}`)}
            </span>
          )}
          {societe.authority && (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
              {societe.authority.code}
              {` · ${tEmirate(societe.authority.emirate)}`}
            </span>
          )}
          {societe.licence_type && (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
              {societe.licence_type.label}
            </span>
          )}
          {shareholderCount > 0 && (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
              {shareholderCount}{" "}
              {shareholderCount > 1
                ? t("list.row.shareholders.plural")
                : t("list.row.shareholders")}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => router.push(companyHref(societe))}
          disabled={disabled}
          aria-label={
            isDraft
              ? t("list.row.edit.aria", { name })
              : t("list.row.open.aria", { name })
          }
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-50"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        {isDraft && (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label={t("list.row.delete.aria", { name })}
            className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
