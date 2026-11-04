"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CompanyFile } from "@/lib/company-types";
import { writeActiveSociete } from "@/lib/active-societe";
import { useLanguage } from "@/components/LanguageProvider";
import { companyDisplayName } from "@/lib/company-view";

interface ChoisirSocieteClientProps {
  societes: CompanyFile[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[1]![0]).toUpperCase();
}

// A small, fixed palette of calm avatar background colors, picked
// deterministically from the société id so the same société always gets
// the same color across renders.
const AVATAR_COLORS = [
  "#7a9a5a",
  "#5f7a45",
  "#a8843c",
  "#4a6fa5",
  "#8a5fa5",
  "#c06a6a",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export default function ChoisirSocieteClient({
  societes,
}: ChoisirSocieteClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    societes.length === 1 ? societes[0]!.id : null
  );

  const selected = useMemo(
    () => societes.find((s) => s.id === selectedId) ?? null,
    [societes, selectedId]
  );

  function handleContinue() {
    if (!selected) return;
    writeActiveSociete({ id: selected.id, name: companyDisplayName(selected) ?? t("company.draft.untitled") });
    router.push("/");
  }

  const hasSocietes = societes.length > 0;

  // Back to the previous page; "/" when the page was opened directly.
  function handleCancel() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-10 sm:py-14">
      <div className="flex flex-col gap-1.5 text-center sm:text-left">
        <h1 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
          {t("choose.title")}
        </h1>
        <p className="text-sm text-neutral-600">{t("choose.subtitle")}</p>
      </div>

      {hasSocietes ? (
        <div className="overflow-hidden rounded-2xl border border-[#e4e9dd] bg-white shadow-sm">
          {societes.map((societe, index) => {
            const isSelected = societe.id === selectedId;
            return (
              <button
                key={societe.id}
                type="button"
                onClick={() => setSelectedId(societe.id)}
                aria-pressed={isSelected}
                className={`flex w-full items-center gap-3 px-4 py-4 text-left transition sm:px-5 ${
                  index > 0 ? "border-t border-[#e4e9dd]" : ""
                } ${isSelected ? "bg-[#f2f6ec]" : "hover:bg-[#f8faf5]"}`}
              >
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: avatarColor(societe.id) }}
                  aria-hidden="true"
                >
                  {initials(companyDisplayName(societe) ?? "?")}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-neutral-900">
                    {companyDisplayName(societe) ?? t("company.draft.untitled")}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {t("choose.updatedRecently")}
                  </span>
                </span>

                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                    isSelected
                      ? "border-[#7a9a5a] bg-[#7a9a5a]"
                      : "border-neutral-300 bg-white"
                  }`}
                >
                  {isSelected && (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#d7e0cc] bg-[#f8faf5] px-6 py-10 text-center">
          <p className="text-base font-semibold text-neutral-800">
            {t("choose.empty.title")}
          </p>
          <p className="text-sm text-neutral-500">
            {t("choose.empty.subtitle")}
          </p>
        </div>
      )}

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/societes/nouvelle"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#7a9a5a] px-5 py-3 text-center text-sm font-extrabold text-[#4f7a37] transition hover:bg-[#f2f6ec]"
        >
          {t("choose.add")} <span aria-hidden="true">+</span>
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleCancel}
            className="w-full rounded-full px-5 py-3 text-center text-sm font-bold text-[#5b6356] transition hover:bg-[#f2f6ec] hover:text-[#2f3b26] sm:w-auto"
          >
            {t("choose.cancel")}
          </button>
          {hasSocietes && (
            <button
              type="button"
              onClick={handleContinue}
              disabled={!selected}
              className="w-full rounded-full bg-[#7a9a5a] px-6 py-3 text-center text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {t("choose.continue")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
