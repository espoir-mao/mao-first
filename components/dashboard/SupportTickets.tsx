"use client";

import { useState, useTransition } from "react";
import type { SupportTicket } from "@/lib/types";
import { followUpSupportTicket, reviewSupportTicket } from "@/app/actions/support";
import { useLanguage } from "../LanguageProvider";

interface SupportTicketsProps {
  societeId: string;
  tickets: SupportTicket[];
  locale: string;
  onChange: (ticket: SupportTicket) => void;
  /** Show the ticket type (contact message / license renewal) under its reference. */
  showType?: boolean;
}

const BTN =
  "rounded-full px-3 py-1 text-xs font-bold transition disabled:opacity-50";

/**
 * The société's own tickets, with what it can do on each:
 * - open ticket → "Relancer" (counts a follow-up for the admin);
 * - ticket treated by the admin (contact messages only) → "Approuver" or
 *   "Refuser" (a refusal needs a reason and reopens the ticket).
 * Demo-only: nothing is sent anywhere, see app/actions/support.ts.
 */
export default function SupportTickets({
  societeId,
  tickets,
  locale,
  onChange,
  showType = false,
}: SupportTicketsProps) {
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refusingId, setRefusingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale);

  function run(
    ticketId: string,
    action: () => Promise<{ success: boolean; data?: SupportTicket; error?: string }>,
    after?: () => void
  ) {
    setError(null);
    setBusyId(ticketId);
    startTransition(async () => {
      const result = await action();
      if (result.success && result.data) {
        onChange(result.data);
        after?.();
      } else {
        setError(result.error ?? "Error");
      }
      setBusyId(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-red-500">{error}</p>}
      <ul className="flex max-h-[520px] flex-col divide-y divide-neutral-100 overflow-y-auto">
        {tickets.map((tk) => {
          const busy = busyId === tk.id;
          const isOpen = tk.status === "ouvert";
          const canReview =
            tk.status === "traite" && tk.type === "contact" && !tk.approval;
          return (
            <li key={tk.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-neutral-800">
                    {tk.subject}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {tk.reference} · {fmt(tk.created_at)}
                    {showType ? ` · ${t(`administration.requests.type.${tk.type}`)}` : ""}
                  </span>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    isOpen
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {t(isOpen ? "support.status.ouvert" : "support.status.traite")}
                </span>
              </div>

              {isOpen && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(tk.id, () => followUpSupportTicket(tk.id, societeId))}
                    className={`${BTN} border border-[#7a9a5a] text-[#4f7a37] hover:bg-[#f2f6ec]`}
                  >
                    {t("dash.support.followUp")}
                  </button>
                  {tk.follow_up_count > 0 && tk.last_follow_up_at && (
                    <span className="text-xs text-neutral-500">
                      {t("dash.support.followedUp", {
                        n: tk.follow_up_count,
                        date: fmt(tk.last_follow_up_at),
                      })}
                    </span>
                  )}
                </div>
              )}

              {isOpen && tk.approval === "refuse" && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  {t("dash.support.refused", { reason: tk.approval_comment ?? "" })}
                </p>
              )}

              {tk.status === "traite" && tk.approval === "approuve" && (
                <p className="text-xs font-semibold text-emerald-700">
                  {t("dash.support.approved")}
                </p>
              )}

              {canReview && refusingId !== tk.id && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-neutral-500">
                    {t("dash.support.awaitingReview")}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(tk.id, () => reviewSupportTicket(tk.id, societeId, "approuve"))
                    }
                    className={`${BTN} bg-[#7a9a5a] text-[#0d0f0c] hover:brightness-95`}
                  >
                    {t("dash.support.approve")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRefusingId(tk.id);
                      setReason("");
                      setError(null);
                    }}
                    className={`${BTN} border border-red-300 text-red-600 hover:bg-red-50`}
                  >
                    {t("dash.support.refuse")}
                  </button>
                </div>
              )}

              {canReview && refusingId === tk.id && (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder={t("dash.support.reasonPlaceholder")}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 outline-none focus:border-[#7a9a5a]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy || reason.trim().length < 3}
                      onClick={() =>
                        run(
                          tk.id,
                          () => reviewSupportTicket(tk.id, societeId, "refuse", reason),
                          () => setRefusingId(null)
                        )
                      }
                      className={`${BTN} bg-red-600 text-white hover:brightness-95`}
                    >
                      {t("dash.support.confirmRefuse")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefusingId(null)}
                      className={`${BTN} text-neutral-500 hover:text-neutral-800`}
                    >
                      {t("dash.support.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
