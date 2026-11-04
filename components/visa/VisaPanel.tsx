"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { VisaApplication } from "@/lib/visa-types";
import { deleteVisaApplication } from "@/app/actions/visa";
import { listAllCorrections } from "@/app/actions/corrections";
import { useActiveSociete } from "@/lib/active-societe";
import { isVisaExpired } from "@/lib/visa-constants";
import { PencilIcon, PlusIcon, TrashIcon } from "../Icons";
import { useLanguage } from "../LanguageProvider";

interface VisaPanelProps {
  initialVisas: VisaApplication[];
  configured: boolean;
  loadError?: string;
}

type StatusKey = "draft" | "pending" | "obtenu" | "rejete" | "expired";

function statusOf(visa: VisaApplication): StatusKey {
  if (visa.decision_status === "obtenu") {
    return visa.expires_at && isVisaExpired(visa.expires_at) ? "expired" : "obtenu";
  }
  if (visa.decision_status === "rejete") return "rejete";
  return visa.status === "brouillon" ? "draft" : "pending";
}

const STATUS_STYLE: Record<StatusKey, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  pending: "bg-amber-100 text-amber-700",
  obtenu: "bg-emerald-100 text-emerald-700",
  rejete: "bg-red-100 text-red-700",
  expired: "bg-neutral-200 text-neutral-600",
};

function applicantName(visa: VisaApplication): string {
  const name = `${visa.applicant?.prenom ?? ""} ${visa.applicant?.nom ?? ""}`.trim();
  return name || visa.tracking_reference || visa.id;
}

/**
 * The single "Visas" page: start a new application, follow the ones in
 * progress (draft or awaiting a decision — editable/deletable), and see the
 * history of every application of the active société with its dates and
 * status. The granting/rejection itself is decided by the MAO team on
 * "/backoffice/visas". Falls back to every visa when no société is selected.
 */
export default function VisaPanel({ initialVisas, configured, loadError }: VisaPanelProps) {
  const router = useRouter();
  const { t, lang } = useLanguage();
  // visas with a correction from MAO waiting for an answer
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  useEffect(() => {
    listAllCorrections().then((r) => {
      if (r.success) {
        setFlagged(
          new Set(
            (r.data ?? [])
              .filter((c) => c.visa_application_id && c.status === "OUVERT")
              .map((c) => c.visa_application_id as string)
          )
        );
      }
    });
  }, []);
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const { activeSociete, mounted } = useActiveSociete();
  const [visas, setVisas] = useState<VisaApplication[]>(initialVisas);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale) : "—");

  const visible = useMemo(() => {
    const list =
      mounted && activeSociete
        ? visas.filter((v) => v.company_id === activeSociete.id)
        : visas;
    return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [visas, mounted, activeSociete]);

  const inProgress = visible.filter((v) => {
    const st = statusOf(v);
    return st === "draft" || st === "pending";
  });
  const granted = visible.filter((v) => ["obtenu", "expired"].includes(statusOf(v))).length;
  const rejected = visible.filter((v) => statusOf(v) === "rejete").length;

  if (!configured) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-neutral-800 sm:p-8">
        <h2 className="text-lg font-bold">{t("list.config.title")}</h2>
        <p className="mt-2 text-sm text-neutral-600">{t("list.config.body")}</p>
      </div>
    );
  }

  function handleDelete(visa: VisaApplication) {
    setError(null);
    if (!window.confirm(t("visa.list.delete.confirm", { name: applicantName(visa) }))) return;
    setPendingId(visa.id);
    startTransition(async () => {
      const result = await deleteVisaApplication(visa.id);
      setPendingId(null);
      if (!result.success) {
        setError(result.error ?? t("visa.list.delete.error"));
        return;
      }
      setVisas((prev) => prev.filter((v) => v.id !== visa.id));
    });
  }

  const statusChip = (visa: VisaApplication) => {
    const st = statusOf(visa);
    const label =
      st === "draft"
        ? t("visa.list.row.status.brouillon")
        : st === "pending"
        ? t("visa.history.pending.title")
        : t(`visa.history.status.${st}`);
    return (
      <span
        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLE[st]}`}
      >
        {label}
      </span>
    );
  };

  const stats = [
    { label: t("visa.panel.stat.inProgress"), value: inProgress.length },
    { label: t("visa.history.status.obtenu"), value: granted },
    { label: t("visa.history.status.rejete"), value: rejected },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
            {t("visa.list.heading.pre")}{" "}
            <span className="text-[#5f7a45]">{t("visa.list.heading.accent")}</span>{" "}
            {t("visa.list.heading.post")}
          </h1>
          <p className="text-sm text-neutral-600">{t("visa.list.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/administration/visas/nouvelle")}
          className="flex items-center justify-center gap-2 rounded-full bg-[#7a9a5a] px-6 py-3 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95"
        >
          {t("visa.list.create")} <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col rounded-2xl border border-neutral-100 bg-white px-4 py-3"
          >
            <span className="text-[11px] font-semibold text-neutral-500">{s.label}</span>
            <span className="text-2xl font-extrabold text-neutral-900">{s.value}</span>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-neutral-100 bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-base font-bold text-neutral-900">
          {t("visa.panel.inProgress.title")} ({inProgress.length})
        </h2>
        {inProgress.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("visa.panel.inProgress.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {inProgress.map((visa) => {
              const busy = isPending && pendingId === visa.id;
              return (
                <li key={visa.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-semibold text-neutral-900">
                      {applicantName(visa)}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {t(`visa.type.${visa.visa_type}.label`)}
                      {visa.tracking_reference ? ` · ${visa.tracking_reference}` : ""} ·{" "}
                      {t("visa.panel.filedOn", { date: fmt(visa.created_at) })}
                    </span>
                  </div>
                  {flagged.has(visa.id) && (
                    <Link
                      href={`/administration/visas/${visa.id}/modifier`}
                      className="flex-shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 hover:underline"
                    >
                      {t("correction.badge")}
                    </Link>
                  )}
                  {statusChip(visa)}
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Link
                      href={`/administration/visas/${visa.id}/modifier`}
                      aria-label={t("visa.list.row.edit.aria", { name: applicantName(visa) })}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(visa)}
                      disabled={busy}
                      aria-label={t("visa.list.row.delete.aria", { name: applicantName(visa) })}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-100 bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-base font-bold text-neutral-900">
          {t("visa.panel.history.title")} ({visible.length})
        </h2>
        {visible.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {mounted && activeSociete
              ? t("visa.list.empty.societe.title")
              : t("visa.panel.history.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                  <th className="pb-2 pr-3">{t("visa.panel.col.applicant")}</th>
                  <th className="pb-2 pr-3">{t("visa.panel.col.type")}</th>
                  <th className="pb-2 pr-3">{t("visa.panel.col.reference")}</th>
                  <th className="pb-2 pr-3">{t("visa.panel.col.filed")}</th>
                  <th className="pb-2 pr-3">{t("visa.panel.col.decided")}</th>
                  <th className="pb-2 pr-3">{t("visa.panel.col.expires")}</th>
                  <th className="pb-2 text-right">{t("visa.panel.col.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visible.map((visa) => (
                  <tr key={visa.id}>
                    <td className="py-2.5 pr-3 font-semibold text-neutral-900">
                      {applicantName(visa)}
                    </td>
                    <td className="py-2.5 pr-3 text-neutral-600">
                      {t(`visa.type.${visa.visa_type}.label`)}
                    </td>
                    <td className="py-2.5 pr-3 text-neutral-600">
                      {visa.tracking_reference ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-neutral-600">{fmt(visa.created_at)}</td>
                    <td className="py-2.5 pr-3 text-neutral-600">{fmt(visa.decided_at)}</td>
                    <td className="py-2.5 pr-3 text-neutral-600">
                      {visa.decision_status === "obtenu" ? fmt(visa.expires_at) : "—"}
                    </td>
                    <td className="py-2.5 text-right">{statusChip(visa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
