"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "../LanguageProvider";
import { listCorrections } from "@/app/actions/corrections";
import type { CorrectionRequest } from "@/lib/correction";
import CorrectionThread from "./CorrectionThread";

/**
 * Loads and shows the corrections MAO sent for a company file (or, with
 * `visaId`, for one visa application). Renders nothing when there is none.
 */
export default function CompanyCorrections({
  companyId,
  visaId,
}: {
  companyId: string;
  visaId?: string;
}) {
  const [rows, setRows] = useState<CorrectionRequest[] | null>(null);

  useEffect(() => {
    let alive = true;
    listCorrections(visaId ? { visaId } : { companyId, companyLevelOnly: true }).then((r) => {
      if (alive && r.success) setRows(r.data ?? []);
    });
    return () => {
      alive = false;
    };
  }, [companyId, visaId]);

  if (!rows || rows.length === 0) return null;
  return <CorrectionThread corrections={rows} kind={visaId ? "visa" : "company"} companyId={companyId} />;
}

/** Dashboard alert: how many requests from MAO wait for the company's answer. */
export function CorrectionBanner({ companyId }: { companyId: string }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<CorrectionRequest[]>([]);

  useEffect(() => {
    let alive = true;
    listCorrections({ companyId }).then((r) => {
      if (alive && r.success) setRows(r.data ?? []);
    });
    return () => {
      alive = false;
    };
  }, [companyId]);

  const count = rows.filter((c) => c.status === "OUVERT").length;
  if (count === 0) return null;

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-bold">{t("correction.banner.title", { count })}</p>
      <Link href="/administration/demandes" className="w-fit font-bold text-[#4f7a37] hover:underline">
        {t("correction.banner.go")} →
      </Link>
    </div>
  );
}
