"use client";

import Link from "next/link";
import { useLanguage } from "../LanguageProvider";

/** Shown by the Administration sub-pages until a société is selected. */
export default function NoSociete() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-neutral-100 bg-white p-6 sm:p-8">
      <p className="text-sm text-neutral-600">{t("administration.noSociete")}</p>
      <Link
        href="/choisir-societe"
        className="rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95"
      >
        {t("administration.chooseSociete")}
      </Link>
    </div>
  );
}
