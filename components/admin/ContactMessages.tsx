"use client";

import { useState, useTransition } from "react";
import type { SupportTicket } from "@/lib/types";
import { useLanguage } from "../LanguageProvider";
import { updateSupportTicketStatus } from "@/app/actions/support";
import { MailIcon } from "../Icons";

interface ContactMessagesProps {
  initialTickets: SupportTicket[];
  configured: boolean;
  loadError?: string;
  /** The hub already shows the page heading. */
  hideHeading?: boolean;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

/**
 * "Messages de contact" (Backoffice MAO > Gestion de demandes): every message
 * sent through "Nous contacter", from signed-in clients and from visitors
 * without account, with the identification the person gave. Demo-only: the
 * status is toggled here, nothing is routed to a real helpdesk.
 */
export default function ContactMessages({
  initialTickets,
  configured,
  loadError,
  hideHeading,
}: ContactMessagesProps) {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState(
    initialTickets.filter((tk) => tk.type === "contact")
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleStatus(ticket: SupportTicket) {
    const nextStatus = ticket.status === "ouvert" ? "traite" : "ouvert";
    setPendingId(ticket.id);
    startTransition(async () => {
      const result = await updateSupportTicketStatus(ticket.id, nextStatus);
      if (result.success && result.data) {
        setTickets((prev) =>
          prev.map((tk) => (tk.id === ticket.id ? result.data! : tk))
        );
      }
      setPendingId(null);
    });
  }

  if (!configured) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {t("support.heading")}
        </h1>
        <p className="text-sm text-neutral-500">
          {loadError ?? "Supabase n'est pas configuré."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!hideHeading && (
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
            {t("support.heading")}
          </h1>
          <p className="max-w-xl text-sm text-neutral-600">{t("support.intro")}</p>
        </div>
      )}

      {loadError && <p className="text-sm text-red-500">{loadError}</p>}

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">
          {t("support.empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-[#4f7a37]">
                    <MailIcon />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                      {t("support.type.contact")}
                    </span>
                    <span className="text-sm font-bold text-neutral-900">
                      {ticket.subject}
                    </span>
                    {ticket.company_name && (
                      <span className="text-xs text-neutral-500">
                        {ticket.company_name}
                      </span>
                    )}
                    {ticket.is_visitor && (
                      <span className="w-fit rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-600">
                        {t("support.visitor")}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    ticket.status === "traite"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {t(
                    ticket.status === "traite"
                      ? "support.status.traite"
                      : "support.status.ouvert"
                  )}
                </span>
              </div>

              {ticket.message && (
                <p className="whitespace-pre-wrap text-sm text-neutral-700">
                  {ticket.message}
                </p>
              )}

              {(ticket.follow_up_count > 0 || ticket.approval) && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {ticket.follow_up_count > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-700">
                      {t("support.followUps")} : {ticket.follow_up_count}
                    </span>
                  )}
                  {ticket.approval && (
                    <span
                      className={`rounded-full px-2.5 py-1 font-bold ${
                        ticket.approval === "approuve"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {t(`support.approval.${ticket.approval}`)}
                      {ticket.approval === "refuse" && ticket.approval_comment
                        ? ` : ${ticket.approval_comment}`
                        : ""}
                    </span>
                  )}
                </div>
              )}

              <dl className="grid grid-cols-1 gap-2 text-xs text-neutral-500 sm:grid-cols-3">
                <div>
                  <dt className="font-semibold text-neutral-400">
                    {t("support.reference.label")}
                  </dt>
                  <dd>{ticket.reference}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-neutral-400">
                    {t("support.requester.label")}
                  </dt>
                  <dd>
                    {ticket.requester_name ?? "—"}
                    {ticket.requester_email && (
                      <>
                        <br />
                        <a href={`mailto:${ticket.requester_email}`} className="text-[#4f7a37] hover:underline">
                          {ticket.requester_email}
                        </a>
                      </>
                    )}
                    {ticket.requester_phone && (
                      <>
                        <br />
                        <a href={`tel:${ticket.requester_phone}`} className="hover:underline">
                          {ticket.requester_phone}
                        </a>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-neutral-400">
                    {formatDateTime(ticket.created_at)}
                  </dt>
                </div>
              </dl>

              <div>
                <button
                  type="button"
                  onClick={() => toggleStatus(ticket)}
                  disabled={isPending && pendingId === ticket.id}
                  className="w-fit rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60"
                >
                  {ticket.status === "traite"
                    ? t("support.markOpen")
                    : t("support.markResolved")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
