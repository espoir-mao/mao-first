"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupportTicket } from "@/lib/types";
import { useActiveSociete } from "@/lib/active-societe";
import SupportTickets from "../dashboard/SupportTickets";
import NoSociete from "./NoSociete";
import MaoRequests from "../corrections/MaoRequests";
import { useLanguage } from "../LanguageProvider";

interface MesDemandesPanelProps {
  initialTickets: SupportTicket[];
  configured: boolean;
  loadError?: string;
}

/**
 * "Administration > Mes demandes": the active société's support tickets —
 * the open ones first (with "Relancer"), then the history of the treated
 * ones (with the "Approuver / Refuser" verdict while it is still pending).
 * Same actions as the dashboard's Support card (SupportTickets).
 */
export default function MesDemandesPanel({
  initialTickets,
  configured,
  loadError,
}: MesDemandesPanelProps) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const { activeSociete, mounted } = useActiveSociete();
  const [tickets, setTickets] = useState(initialTickets);

  useEffect(() => setTickets(initialTickets), [initialTickets]);

  const mine = useMemo(
    () =>
      activeSociete
        ? tickets.filter((tk) => tk.company_id === activeSociete.id)
        : [],
    [tickets, activeSociete]
  );
  const open = mine.filter((tk) => tk.status === "ouvert");
  const history = mine.filter((tk) => tk.status === "traite");

  const update = (updated: SupportTicket) =>
    setTickets((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {t("administration.requests.heading")}
        </h1>
        <p className="max-w-xl text-sm text-neutral-600">
          {t("administration.requests.intro")}
        </p>
      </div>

      {(!configured || loadError) && (
        <p className="text-sm text-red-500">
          {loadError ?? t("administration.loadError")}
        </p>
      )}

      {!mounted ? null : !activeSociete ? (
        <NoSociete />
      ) : (
        <>
          <MaoRequests companyId={activeSociete.id} />
          <section className="rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-base font-bold text-neutral-900">
              {t("administration.requests.open.title")} ({open.length})
            </h2>
            {open.length === 0 ? (
              <p className="text-sm text-neutral-500">
                {t("administration.requests.open.empty")}
              </p>
            ) : (
              <SupportTickets
                societeId={activeSociete.id}
                tickets={open}
                locale={locale}
                onChange={update}
                showType
              />
            )}
          </section>

          <section className="rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-base font-bold text-neutral-900">
              {t("administration.requests.history.title")} ({history.length})
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-neutral-500">
                {t("administration.requests.history.empty")}
              </p>
            ) : (
              <SupportTickets
                societeId={activeSociete.id}
                tickets={history}
                locale={locale}
                onChange={update}
                showType
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
