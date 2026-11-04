"use client";

import { useState } from "react";
import type { CorrectionRequest } from "@/lib/correction";
import type { CompanyFile } from "@/lib/company-types";
import type { SupportTicket } from "@/lib/types";
import { useLanguage } from "../LanguageProvider";
import AdminRequestQueue from "./AdminRequestQueue";
import ContactMessages from "./ContactMessages";

interface Props {
  requests: CorrectionRequest[];
  companies: CompanyFile[];
  tickets: SupportTicket[];
  initialCompanyId?: string;
  initialTab?: string;
  configured: boolean;
  loadError?: string;
}

/**
 * Backoffice MAO > Gestion de demandes: the requests MAO sent to the companies
 * and the contact messages received ("Nous contacter", signed-in or not).
 */
export default function AdminRequestsHub({ requests, companies, tickets, initialCompanyId, initialTab, configured, loadError }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"requests" | "contact">(initialTab === "contact" ? "contact" : "requests");
  const toProcess = requests.filter((r) => r.status === "REPONDU").length;
  const openMessages = tickets.filter((x) => x.type === "contact" && x.status === "ouvert").length;

  const tabs = [
    { id: "requests" as const, label: t("adminRequests.hub.requests"), count: toProcess },
    { id: "contact" as const, label: t("adminRequests.hub.contact"), count: openMessages },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">{t("adminRequests.heading")}</h1>
        <p className="max-w-xl text-sm text-neutral-600">{t("adminRequests.hub.intro")}</p>
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            aria-pressed={tab === x.id}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${
              tab === x.id ? "border-[#7a9a5a] text-[#2f3b26]" : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {x.label}
            {x.count > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white">{x.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "requests" ? (
        <AdminRequestQueue
          requests={requests}
          companies={companies}
          initialCompanyId={initialCompanyId}
          hideHeading
          configured={configured}
          loadError={loadError}
        />
      ) : (
        <ContactMessages initialTickets={tickets} configured={configured} loadError={loadError} hideHeading />
      )}
    </div>
  );
}
