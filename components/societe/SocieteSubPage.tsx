"use client";

import { useEffect, useState } from "react";
import type { CompanyFile } from "@/lib/company-types";
import {
  clearActiveSociete,
  useActiveSociete,
  writeActiveSociete,
} from "@/lib/active-societe";
import { companyDisplayName, statusBadgeClasses } from "@/lib/company-view";
import ListPageHeading from "../ListPageHeading";
import SocieteManager from "./SocieteManager";
import AProposPanel from "./AProposPanel";
import LicensePanel from "./LicensePanel";
import { useLanguage } from "../LanguageProvider";

interface SocieteSubPageProps {
  panel: "about" | "license";
  initialSocietes: CompanyFile[];
  configured: boolean;
  loadError?: string;
}

/**
 * Shared shell for the "/a-propos" and "/licence" sub-pages: resolves the
 * currently active société (see lib/active-societe.ts + /choisir-societe)
 * the same way the main société dashboard (SocieteHome) does, shows its
 * name/badges for context, then renders the requested panel. Falls back to
 * the full société list when nothing is selected yet, matching the
 * dashboard's own fallback.
 */
export default function SocieteSubPage({
  panel,
  initialSocietes,
  configured,
  loadError,
}: SocieteSubPageProps) {
  const { t, tEmirate } = useLanguage();
  const { activeSociete, mounted } = useActiveSociete();

  const fetchedSociete =
    mounted && activeSociete
      ? initialSocietes.find((s) => s.id === activeSociete.id)
      : undefined;
  const isStale = mounted && Boolean(activeSociete) && !fetchedSociete;

  useEffect(() => {
    if (isStale) clearActiveSociete();
  }, [isStale]);

  // The name kept in localStorage is only a snapshot taken when the société was
  // picked: refresh it from the database so the Sidebar and the page agree.
  const freshName = fetchedSociete ? companyDisplayName(fetchedSociete) : null;
  useEffect(() => {
    if (fetchedSociete && freshName && activeSociete && freshName !== activeSociete.name) {
      writeActiveSociete({ id: fetchedSociete.id, name: freshName });
    }
  }, [fetchedSociete, freshName, activeSociete]);

  const [override, setOverride] = useState<CompanyFile | null>(null);
  useEffect(() => {
    setOverride(null);
  }, [fetchedSociete?.id]);
  const societe = override ?? fetchedSociete;

  if (!configured || !mounted || !activeSociete || !societe) {
    return (
      <div className="flex flex-col gap-8">
        <ListPageHeading />
        <SocieteManager
          initialSocietes={initialSocietes}
          configured={configured}
          loadError={loadError}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {companyDisplayName(societe) ?? t("company.draft.untitled")}
        </h1>
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pt-1">
          <span
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClasses(
              societe.status
            )}`}
          >
            {t(`status.${societe.status}`)}
          </span>
          {societe.jurisdiction_type && (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-spring-200 px-2.5 py-1 text-xs font-bold text-[#3f5029]">
              {t(`jurisdiction.${societe.jurisdiction_type}`)}
            </span>
          )}
          {societe.authority && (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
              {societe.authority.name} · {tEmirate(societe.authority.emirate)}
            </span>
          )}
          {societe.licence_type && (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
              {societe.licence_type.label}
            </span>
          )}
        </div>
      </div>

      {panel === "about" ? (
        <AProposPanel societe={societe} onUpdated={setOverride} />
      ) : (
        <LicensePanel societe={societe} onUpdated={setOverride} />
      )}
    </div>
  );
}
