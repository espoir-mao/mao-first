"use client";

import Link from "next/link";
import { useActiveSociete } from "@/lib/active-societe";
import ListPageHeading from "../ListPageHeading";
import { useLanguage } from "../LanguageProvider";

/**
 * Heading for the full société list page (/societes). Adds a small
 * "back to my société" link back to the home dashboard when an active
 * société is currently selected (see lib/active-societe.ts), resolved only
 * after mount to stay SSR-safe.
 */
export default function SocietesListHeader() {
  const { t } = useLanguage();
  const { activeSociete, mounted } = useActiveSociete();

  return (
    <div className="flex flex-col gap-3">
      {mounted && activeSociete && (
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-[#4f7a37] hover:underline"
        >
          ← {t("societes.back.toDashboard")}
        </Link>
      )}
      <ListPageHeading />
    </div>
  );
}
