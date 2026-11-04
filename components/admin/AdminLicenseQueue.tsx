"use client";

import { useState, useTransition } from "react";
import type { CompanyFile } from "@/lib/company-types";
import type { SupportTicket } from "@/lib/types";
import { useLanguage } from "../LanguageProvider";
import { issueCompanyLicence, renewCompanyLicence } from "@/app/actions/companies";
import { companyDisplayName } from "@/lib/company-view";

export interface LicenseHistoryRow {
  societeId: string;
  societeName: string;
  action: "attribuee" | "renouvelee";
  number: string;
  type: string;
  expires_at: string;
  changed_at: string;
}

interface AdminLicenseQueueProps {
  pendingAttribution: CompanyFile[];
  renewalTickets: SupportTicket[];
  historyRows: LicenseHistoryRow[];
  configured: boolean;
  loadError?: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/**
 * "Traitement des licences" admin sub-page: attribute the trade license for
 * sociétés that have been validated but have none yet (see
 * `issueSocieteLicense`), process pending renewal requests (see
 * `renewSocieteLicense`), and show the full cross-société license history.
 * No isolation by société — this is the admin-wide view; the requester's
 * own "Licence" page only ever shows their own société's current license.
 */
export default function AdminLicenseQueue({
  pendingAttribution,
  renewalTickets,
  historyRows,
  configured,
  loadError,
}: AdminLicenseQueueProps) {
  const { t, tMessage } = useLanguage();
  const [pending, setPending] = useState(pendingAttribution);
  const [renewals, setRenewals] = useState(renewalTickets);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function attribute(societe: CompanyFile) {
    setError(null);
    setPendingId(societe.id);
    startTransition(async () => {
      const result = await issueCompanyLicence(societe.id);
      setPendingId(null);
      if (!result.success) {
        setError(tMessage(result.error) ?? t("admin.licenses.error"));
        return;
      }
      setPending((prev) => prev.filter((s) => s.id !== societe.id));
    });
  }

  function renew(ticket: SupportTicket) {
    if (!ticket.company_id) return;
    setError(null);
    setPendingId(ticket.id);
    startTransition(async () => {
      const result = await renewCompanyLicence(
        ticket.company_id as string,
        ticket.reference
      );
      setPendingId(null);
      if (!result.success) {
        setError(tMessage(result.error) ?? t("admin.licenses.error"));
        return;
      }
      setRenewals((prev) => prev.filter((t) => t.id !== ticket.id));
    });
  }

  if (!configured) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {t("admin.licenses.heading")}
        </h1>
        <p className="text-sm text-neutral-500">
          {loadError ?? "Supabase n'est pas configuré."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {t("admin.licenses.heading")}
        </h1>
        <p className="max-w-xl text-sm text-neutral-600">
          {t("admin.licenses.intro")}
        </p>
      </div>

      {loadError && <p className="text-sm text-red-500">{loadError}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">
          {t("admin.licenses.pending.title")}
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">
            {t("admin.licenses.pending.empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((societe) => (
              <div
                key={societe.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-neutral-900">
                    {companyDisplayName(societe) ?? t("company.draft.untitled")}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {societe.licence_type?.label ?? "—"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => attribute(societe)}
                  disabled={isPending && pendingId === societe.id}
                  className="rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
                >
                  {isPending && pendingId === societe.id
                    ? t("admin.licenses.attributing")
                    : t("admin.licenses.attribute")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">
          {t("admin.licenses.renewals.title")}
        </h2>
        {renewals.length === 0 ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">
            {t("admin.licenses.renewals.empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {renewals.map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-neutral-900">
                      {ticket.company_name ?? "—"}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {t("support.reference.label")}: {ticket.reference}
                    </span>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                    {t("support.status.ouvert")}
                  </span>
                </div>
                {ticket.message && (
                  <p className="whitespace-pre-wrap text-sm text-neutral-700">
                    {ticket.message}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                  <span>{formatDateTime(ticket.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => renew(ticket)}
                    disabled={isPending && pendingId === ticket.id}
                    className="rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
                  >
                    {isPending && pendingId === ticket.id
                      ? t("admin.licenses.renewing")
                      : t("admin.licenses.renew")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">
          {t("admin.licenses.history.title")}
        </h2>
        {historyRows.length === 0 ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">
            {t("admin.licenses.history.empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {historyRows.map((row, index) => (
              <div
                key={`${row.societeId}-${row.changed_at}-${index}`}
                className="flex flex-col gap-2 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-neutral-900">
                      {row.societeName}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {row.number} ·{" "}
                      {t(
                        row.action === "attribuee"
                          ? "admin.licenses.history.action.attribuee"
                          : "admin.licenses.history.action.renouvelee"
                      )}
                    </span>
                  </div>
                  <span className="flex-shrink-0 text-xs text-neutral-500">
                    {formatDateTime(row.changed_at)}
                  </span>
                </div>
                <dl className="grid grid-cols-1 gap-2 text-xs text-neutral-500 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-neutral-400">
                      {t("home.license.type.label")}
                    </dt>
                    <dd className="text-sm text-neutral-700">
                      {row.type || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-400">
                      {t("home.license.expiresAt.label")}
                    </dt>
                    <dd className="text-sm text-neutral-700">
                      {formatDate(row.expires_at)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
