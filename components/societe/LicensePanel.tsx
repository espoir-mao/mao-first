"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CompanyFile } from "@/lib/company-types";
import { useLanguage } from "../LanguageProvider";
import { requestCompanyLicenceRenewal } from "@/app/actions/companies";
import { isLicenseExpired } from "@/lib/societe-constants";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

interface LicensePanelProps {
  societe: CompanyFile;
  onUpdated: (updated: CompanyFile) => void;
}

/**
 * "Licence" sub-page content for the currently active société: once the
 * request has been validated (see AProposPanel) a trade license is
 * generated based on the activity, shown here with its issue/expiry dates
 * and status, plus a renewal action that opens a mock support ticket
 * addressed to mao@support — a simulation, no real email is sent.
 */
export default function LicensePanel({ societe, onUpdated }: LicensePanelProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const hasLicense = Boolean(
    societe.licence_number && societe.licence_issued_at && societe.licence_expires_at
  );
  const license = {
    number: societe.licence_number ?? "",
    issued_at: societe.licence_issued_at ?? "",
    expires_at: societe.licence_expires_at ?? "",
  };
  const renewalTickets = societe.licence_renewal_tickets ?? [];

  const [showRenewalForm, setShowRenewalForm] = useState(false);
  const [renewalMessage, setRenewalMessage] = useState("");
  const [isSubmittingRenewal, startSubmittingRenewal] = useTransition();
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [lastTicketRef, setLastTicketRef] = useState<string | null>(null);

  function submitRenewalRequest() {
    setRenewalError(null);
    startSubmittingRenewal(async () => {
      const result = await requestCompanyLicenceRenewal(societe.id, renewalMessage);
      if (!result.success || !result.data) {
        setRenewalError(result.error ?? t("home.license.renewal.error"));
        return;
      }
      setLastTicketRef(result.data.ticket.reference);
      onUpdated({
        ...societe,
        licence_renewal_tickets: [...renewalTickets, result.data.ticket],
      });
      setShowRenewalForm(false);
      setRenewalMessage("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-neutral-100 bg-white p-6 sm:p-8">
        {!hasLicense ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold text-neutral-900">
              {t("home.tabs.license")}
            </h2>
            <p className="text-sm text-neutral-600">
              {t("home.license.placeholder.title")}
            </p>
            {societe.status === "NAME_APPROVED" || societe.status === "INITIAL_APPROVAL" ? (
              <p className="text-xs text-neutral-500">
                {t("home.license.placeholder.awaitingAttribution")}
              </p>
            ) : (
              <p className="text-xs text-neutral-500">
                {t("home.license.placeholder.status", {
                  status: t(`status.${societe.status}`),
                })}
              </p>
            )}
          </div>
        ) : (
          (() => {
            const expired = isLicenseExpired(license.expires_at);
            return (
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-bold text-neutral-900">
                  {t("home.tabs.license")}
                </h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                      {t("home.license.number.label")}
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-800">
                      {license.number}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                      {t("home.license.type.label")}
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-800">
                      {societe.licence_type?.label ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                      {t("home.license.issuedAt.label")}
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-800">
                      {formatDateTime(license.issued_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                      {t("home.license.expiresAt.label")}
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-800">
                      {formatDateTime(license.expires_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                      {t("home.license.status.label")}
                    </dt>
                    <dd className="mt-1">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                          expired
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {expired
                          ? t("home.license.status.expired")
                          : t("home.license.status.active")}
                      </span>
                    </dd>
                  </div>
                </dl>

                {renewalError && (
                  <p className="text-sm text-red-500">{renewalError}</p>
                )}
                {lastTicketRef && !showRenewalForm && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <p>{t("home.license.renewal.success")}</p>
                    <p className="mt-1 text-xs">
                      {t("home.license.renewal.ticketRef", {
                        ref: lastTicketRef,
                      })}
                    </p>
                  </div>
                )}

                {!showRenewalForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowRenewalForm(true);
                      setLastTicketRef(null);
                      setRenewalError(null);
                    }}
                    className="w-fit rounded-full border border-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#4f7a37] transition hover:bg-[#f2f6ec]"
                  >
                    {t("home.license.renewal.button")}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <label className="text-sm font-medium text-neutral-600">
                      {t("home.license.renewal.message.label")}
                    </label>
                    <textarea
                      rows={3}
                      value={renewalMessage}
                      onChange={(e) => setRenewalMessage(e.target.value)}
                      placeholder={t(
                        "home.license.renewal.message.placeholder"
                      )}
                      className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-[#7a9a5a]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={submitRenewalRequest}
                        disabled={isSubmittingRenewal}
                        className="rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
                      >
                        {isSubmittingRenewal
                          ? t("home.license.renewal.submitting")
                          : t("home.license.renewal.submit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRenewalForm(false)}
                        disabled={isSubmittingRenewal}
                        className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-100"
                      >
                        {t("home.license.renewal.cancel")}
                      </button>
                    </div>
                  </div>
                )}

                {renewalTickets.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                      {t("home.license.renewal.history.title")}
                    </h3>
                    <div className="flex flex-col divide-y divide-neutral-100">
                      {renewalTickets.map((ticket) => (
                        <div
                          key={ticket.reference}
                          className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-sm font-semibold text-neutral-800">
                            {ticket.reference}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {formatDateTime(ticket.created_at)} ·{" "}
                            {ticket.status === "ouvert"
                              ? t("home.license.renewal.ticket.status.ouvert")
                              : ticket.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
