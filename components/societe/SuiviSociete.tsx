"use client";

import { CorrectionBanner } from "../corrections/CompanyCorrections";
import Link from "next/link";
import { useState } from "react";
import type { CompanyFile } from "@/lib/company-types";
import { companyDisplayName } from "@/lib/company-view";
import { useLanguage } from "../LanguageProvider";
import CompanyTracking from "./CompanyTracking";

export default function SuiviSociete({ initial }: { initial: CompanyFile }) {
  const { t } = useLanguage();
  const [company, setCompany] = useState(initial);
  return (
    <div className="flex flex-col gap-5">
      <Link href="/societes" className="w-fit text-sm font-bold text-[#4f7a37] hover:underline">
        ← {t("company.tracking.backToList")}
      </Link>
      <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        {companyDisplayName(company) ?? t("company.draft.untitled")}
      </h1>
      <CorrectionBanner companyId={company.id} />
      <CompanyTracking company={company} onUpdated={setCompany} />
    </div>
  );
}
