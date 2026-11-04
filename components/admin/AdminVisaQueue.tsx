"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { VisaApplication } from "@/lib/visa-types";
import { simulateVisaDecision } from "@/app/actions/visa";
import { isVisaExpired } from "@/lib/visa-constants";
import { useLanguage } from "../LanguageProvider";

interface AdminVisaQueueProps {
  initialVisas: VisaApplication[];
  societeNames: Record<string, string>;
  configured: boolean;
  loadError?: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function applicantName(visa: VisaApplication): string {
  const name = `${visa.applicant?.prenom ?? ""} ${visa.applicant?.nom ?? ""}`.trim();
  return name || visa.tracking_reference || visa.id;
}

/**
 * "Suivi des visas" admin sub-page: every visa application across every
 * société (no isolation), split into requests awaiting a decision — with
 * the grant/reject action, moved here from the per-société "Historique"
 * sidebar sub-page, which is now read-only for the requester — and a full
 * decision history. There is no real government/authority integration
 * behind this; it's the demo stand-in for that review.
 */
export default function AdminVisaQueue({
  initialVisas,
  societeNames,
  configured,
  loadError,
}: AdminVisaQueueProps) {
  const { t, tMessage } = useLanguage();
  const [visas, setVisas] = useState(initialVisas);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const awaitingDecision = useMemo(
    () => visas.filter((v) => (v.decision_status ?? "en_attente") === "en_attente"),
    [visas]
  );
  const decided = useMemo(
    () =>
      visas
        .filter((v) => v.decision_status === "obtenu" || v.decision_status === "rejete")
        .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? "")),
    [visas]
  );

  function societeLabel(visa: VisaApplication): string {
    if (!visa.company_id) return t("admin.visas.societe.none");
    return societeNames[visa.company_id] ?? t("admin.visas.societe.none");
  }

  function decide(visa: VisaApplication, decision: "obtenu" | "rejete") {
    setActionError(null);
    setPendingId(visa.id);
    startTransition(async () => {
      const result = await simulateVisaDecision(visa.id, decision);
      setPendingId(null);
      if (!result.success || !result.data) {
        setActionError(tMessage(result.error) ?? t("visa.history.error"));
        return;
      }
      setVisas((prev) => prev.map((v) => (v.id === visa.id ? result.data! : v)));
    });
  }

  if (!configured) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {t("admin.visas.heading")}
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
          {t("admin.visas.heading")}
        </h1>
        <p className="max-w-xl text-sm text-neutral-600">
          {t("admin.visas.intro")}
        </p>
      </div>

      {loadError && <p className="text-sm text-red-500">{loadError}</p>}
      {actionError && <p className="text-sm text-red-500">{actionError}</p>}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">
          {t("admin.visas.pending.title")}
        </h2>
        {awaitingDecision.length === 0 ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">
            {t("admin.visas.pending.empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {awaitingDecision.map((visa) => (
              <div
                key={visa.id}
                className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Link href={`/backoffice/visas/${visa.id}`} className="text-sm font-bold text-neutral-900 hover:underline">
                      {applicantName(visa)} <span className="text-xs font-semibold text-[#4f7a37]">· {t("dossier.open")} →</span>
                    </Link>
                    <span className="text-xs text-neutral-500">
                      {t(`visa.type.${visa.visa_type}.label`)}
                    </span>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                    {t("visa.list.row.status.soumis")}
                  </span>
                </div>
                <dl className="grid grid-cols-1 gap-2 text-xs text-neutral-500 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-neutral-400">
                      {t("admin.visas.societe.label")}
                    </dt>
                    <dd>{societeLabel(visa)}</dd>
                  </div>
                  {visa.tracking_reference && (
                    <div>
                      <dt className="font-semibold text-neutral-400">
                        {t("support.reference.label")}
                      </dt>
                      <dd>{visa.tracking_reference}</dd>
                    </div>
                  )}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => decide(visa, "obtenu")}
                    disabled={isPending && pendingId === visa.id}
                    className="rounded-full bg-[#7a9a5a] px-4 py-2 text-xs font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
                  >
                    {t("visa.history.action.grant")}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(visa, "rejete")}
                    disabled={isPending && pendingId === visa.id}
                    className="rounded-full border border-red-300 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {t("visa.history.action.reject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">
          {t("admin.visas.history.title")}
        </h2>
        {decided.length === 0 ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">
            {t("admin.visas.history.empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {decided.map((visa) => {
              const expired = visa.expires_at ? isVisaExpired(visa.expires_at) : false;
              return (
                <div
                  key={visa.id}
                  className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <Link href={`/backoffice/visas/${visa.id}`} className="text-sm font-bold text-neutral-900 hover:underline">
                        {applicantName(visa)} <span className="text-xs font-semibold text-[#4f7a37]">· {t("dossier.open")} →</span>
                      </Link>
                      <span className="text-xs text-neutral-500">
                        {t(`visa.type.${visa.visa_type}.label`)}
                      </span>
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        visa.decision_status === "obtenu"
                          ? expired
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                          : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {visa.decision_status === "obtenu"
                        ? expired
                          ? t("visa.history.status.expired")
                          : t("visa.history.status.obtenu")
                        : t("visa.history.status.rejete")}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 gap-2 text-xs text-neutral-500 sm:grid-cols-4">
                    <div>
                      <dt className="font-semibold text-neutral-400">
                        {t("admin.visas.societe.label")}
                      </dt>
                      <dd className="text-sm text-neutral-700">
                        {societeLabel(visa)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-neutral-400">
                        {t("visa.history.obtainedAt.label")}
                      </dt>
                      <dd className="text-sm text-neutral-700">
                        {formatDate(visa.decided_at)}
                      </dd>
                    </div>
                    {visa.decision_status === "obtenu" && (
                      <div>
                        <dt className="font-semibold text-neutral-400">
                          {t("visa.history.expiresAt.label")}
                        </dt>
                        <dd className="text-sm text-neutral-700">
                          {formatDate(visa.expires_at)}
                        </dd>
                      </div>
                    )}
                    {visa.tracking_reference && (
                      <div>
                        <dt className="font-semibold text-neutral-400">
                          {t("support.reference.label")}
                        </dt>
                        <dd className="text-sm text-neutral-700">
                          {visa.tracking_reference}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
