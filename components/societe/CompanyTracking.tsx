"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { CompanyFile } from "@/lib/company-types";
import { TRACKING_STEPS, trackingProgress, validateTradeName } from "@/lib/company-domain";
import { issueMessage, firstIssueMessage } from "@/lib/issue-text";
import { companyHref, statusBadgeClasses } from "@/lib/company-view";
import { proposeNewCompanyNames } from "@/app/actions/companies";
import { useLanguage } from "../LanguageProvider";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

interface CompanyTrackingProps {
  company: CompanyFile;
  onUpdated: (updated: CompanyFile) => void;
}

/**
 * Step 10 of the creation flow, also shown on "À propos": where the file
 * stands with the guichet (submitted > in review > name approved > initial
 * approval > licence issued), the three name proposals with the guichet's
 * decision, and — when every name was refused — a form to propose new ones.
 * The submission to the guichet itself is done by hand in the Backoffice MAO.
 */
export default function CompanyTracking({ company, onUpdated }: CompanyTrackingProps) {
  const { t } = useLanguage();
  const progress = trackingProgress(company.status);
  const [newNames, setNewNames] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filled = newNames.map((n) => n.trim()).filter(Boolean);
  const liveIssues = newNames.map((n) => (n.trim() ? validateTradeName(n) : []));

  function submitNames() {
    setError(null);
    startTransition(async () => {
      const result = await proposeNewCompanyNames(company.id, filled);
      if (!result.success || !result.data) {
        setError(firstIssueMessage(t, result, t("company.tracking.newNames.error")));
        return;
      }
      onUpdated(result.data);
      setNewNames(["", "", ""]);
    });
  }

  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-neutral-900">{t("home.about.status.label")}</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusBadgeClasses(
            company.status
          )}`}
        >
          {t(`status.${company.status}`)}
        </span>
        {company.tracking_reference && (
          <span className="text-xs text-neutral-500">
            {t("home.about.tracking.label")}: {company.tracking_reference}
          </span>
        )}
      </div>

      {company.status === "DRAFT" ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p>{t("company.tracking.draft")}</p>
          <Link
            href={companyHref(company)}
            className="mt-2 inline-block font-bold text-[#4f7a37] hover:underline"
          >
            {t("company.tracking.resume")} →
          </Link>
        </div>
      ) : (
        <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-5">
          {TRACKING_STEPS.map((step, index) => {
            const done = index <= progress.reached;
            const current = index === progress.reached && !progress.rejected;
            const blocked = progress.nameRejected && step === "NAME_APPROVED";
            return (
              <li
                key={step}
                className={`flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-xs ${
                  blocked
                    ? "border-red-300 bg-red-50 text-red-700"
                    : done
                      ? current
                        ? "border-[#7a9a5a] bg-[#f2f6ec] text-[#3f5029]"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-neutral-200 bg-white text-neutral-400"
                }`}
              >
                <span className="font-bold uppercase tracking-wide">
                  {done && !blocked ? "✓ " : `${index + 1}. `}
                  {t(`status.${step}`)}
                </span>
                {done && !blocked && (
                  <span className="text-[11px] opacity-80">
                    {(() => {
                      const entry = [...company.status_history].reverse().find((h) => h.status === step);
                      return entry ? formatDateTime(entry.changed_at) : "";
                    })()}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {progress.rejected && company.rejection_reason && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <span className="text-xs font-bold uppercase tracking-wide text-red-700">
            {t("home.about.rejection.title")}
          </span>
          <p className="mt-1 whitespace-pre-wrap text-sm text-red-800">{company.rejection_reason}</p>
        </div>
      )}

      {company.names.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            {t("home.about.names.title")}
          </h3>
          <div className="mt-2 flex flex-col gap-1.5">
            {company.names.map((n) => (
              <div
                key={n.id}
                className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-sm ${
                  n.status === "APPROVED"
                    ? "border-emerald-300 bg-emerald-50 font-bold text-emerald-800"
                    : n.status === "REJECTED"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-neutral-200 bg-white text-neutral-600"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>
                    <span className="text-xs font-semibold text-neutral-400">#{n.rank}</span>{" "}
                    {n.proposed_name}
                  </span>
                  <span className="flex-shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                    {t(`company.name.status.${n.status}`)}
                  </span>
                </div>
                {n.status === "REJECTED" && n.rejection_reason && (
                  <span className="text-xs font-normal">{n.rejection_reason}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {company.status === "NAME_REJECTED" && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">{t("company.tracking.nameRejected.title")}</p>
          <p className="mt-1 text-sm text-red-700">{t("company.tracking.nameRejected.body")}</p>
          <div className="mt-3 flex flex-col gap-2">
            {newNames.map((value, i) => (
              <div key={i} className="flex flex-col gap-1">
                <input
                  value={value}
                  onChange={(e) =>
                    setNewNames((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  placeholder={t("company.tracking.newNames.placeholder", { n: i + 1 })}
                  maxLength={60}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
                />
                {liveIssues[i].map((issue) => (
                  <span key={issue.code} className="text-xs text-red-600">
                    {issueMessage(t, issue)}
                  </span>
                ))}
              </div>
            ))}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={submitNames}
            disabled={isPending || filled.length === 0 || liveIssues.some((l) => l.length > 0)}
            className="mt-3 rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
          >
            {isPending ? t("company.tracking.newNames.sending") : t("company.tracking.newNames.send")}
          </button>
        </div>
      )}

      {company.status !== "DRAFT" && (
        <p className="mt-5 text-xs text-neutral-500">{t("company.tracking.manualNote")}</p>
      )}

      {company.status_history.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            {t("home.about.status.history.title")}
          </h3>
          <ul className="mt-2 flex flex-col gap-2 border-l-2 border-neutral-100 pl-4">
            {company.status_history.map((entry, index) => (
              <li key={index} className="text-sm text-neutral-600">
                <span className="font-semibold text-neutral-800">{t(`status.${entry.status}`)}</span> —{" "}
                {formatDateTime(entry.changed_at)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
