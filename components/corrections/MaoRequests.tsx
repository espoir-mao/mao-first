"use client";

import { useEffect, useState } from "react";
import { listCorrections } from "@/app/actions/corrections";
import type { CorrectionRequest } from "@/lib/correction";
import { useLanguage } from "../LanguageProvider";
import CorrectionThread from "./CorrectionThread";

/**
 * "Gestion de demandes": what the MAO team asked the active société (on its
 * file, then on its visa applications), with the form to answer each open one.
 */
export default function MaoRequests({ companyId }: { companyId: string }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<CorrectionRequest[] | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    listCorrections({ companyId }).then((r) => {
      if (alive) setRows(r.success ? r.data ?? [] : []);
    });
    return () => {
      alive = false;
    };
  }, [companyId]);

  if (rows === null) return null;
  const company = rows.filter((c) => !c.visa_application_id);
  const visa = rows.filter((c) => c.visa_application_id);

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 && (
        <section className="rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6">
          <h2 className="mb-2 text-base font-bold text-neutral-900">{t("requests.mao.title")}</h2>
          <p className="text-sm text-neutral-500">{t("requests.mao.empty")}</p>
        </section>
      )}
      {company.length > 0 && (
        <CorrectionThread
          corrections={company}
          kind="company"
          companyId={companyId}
          titleKey="requests.mao.company"
          introKey="requests.mao.intro"
        />
      )}
      {visa.length > 0 && (
        <CorrectionThread
          corrections={visa}
          kind="visa"
          companyId={companyId}
          titleKey="requests.mao.visa"
          introKey="requests.mao.intro"
        />
      )}
    </div>
  );
}
