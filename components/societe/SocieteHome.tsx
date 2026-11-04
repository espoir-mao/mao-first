"use client";

import type { CompanyFile } from "@/lib/company-types";
import {
  clearActiveSociete,
  useActiveSociete,
  writeActiveSociete,
} from "@/lib/active-societe";
import { companyDisplayName } from "@/lib/company-view";
import { useEffect, useState } from "react";
import ListPageHeading from "../ListPageHeading";
import SocieteManager from "./SocieteManager";
import SocieteDashboard from "../dashboard/SocieteDashboard";
import IllustrationPanel from "./IllustrationPanel";
import type { SupportTicket } from "@/lib/types";
import type { VisaApplication } from "@/lib/visa-types";

interface SocieteHomeProps {
  initialSocietes: CompanyFile[];
  configured: boolean;
  loadError?: string;
  visas?: VisaApplication[];
  tickets?: SupportTicket[];
}

/**
 * Home page content. Shows the per-société dashboard for the currently
 * active société (see lib/active-societe.ts + /choisir-societe) when one is
 * selected and still exists among the fetched sociétés, otherwise falls back
 * to the existing full list (`SocieteManager`) — including before hydration
 * (so SSR and the first client render stay in sync) and when the stored
 * active société id no longer matches any fetched société (e.g. it was
 * deleted), in which case the stale localStorage entry is also cleared.
 *
 * The request-tracking / status / license content that used to live here as
 * two in-page tabs now has its own dedicated sub-pages ("/a-propos" and
 * "/licence"), reachable from the Sidebar under this société's entry — see
 * SocieteSubPage, AProposPanel and LicensePanel.
 */
export default function SocieteHome({
  initialSocietes,
  configured,
  loadError,
  visas = [],
  tickets = [],
}: SocieteHomeProps) {
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
      <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-6 px-5 py-8 sm:max-w-6xl sm:py-12 lg:grid-cols-[2fr_3fr] lg:gap-10">
        <IllustrationPanel
          chip1Key="list.illustration.chip1"
          titleKey="list.illustration.title"
          bodyKey="list.illustration.body"
        />
        <div className="flex flex-col gap-8">
          <ListPageHeading />
          <SocieteManager
            initialSocietes={initialSocietes}
            configured={configured}
            loadError={loadError}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 py-4 sm:px-4">
      <SocieteDashboard societe={societe} visas={visas} tickets={tickets} />
    </div>
  );
}
