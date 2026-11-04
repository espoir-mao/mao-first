"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/types";
import type { CompanyFile, CompanyNameRequest } from "@/lib/company-types";
import type { CorrectionRequest } from "@/lib/correction";
import { validateTradeName } from "@/lib/company-domain";
import { firstIssueMessage, issueMessage } from "@/lib/issue-text";
import { companyDisplayName, formatAed, statusBadgeClasses } from "@/lib/company-view";
import { useLanguage } from "../LanguageProvider";
import {
  approveCompanyName,
  grantCompanyInitialApproval,
  rejectCompany,
  rejectCompanyName,
  startCompanyReview,
} from "@/app/actions/companies";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

interface AdminSocieteQueueProps {
  initialSocietes: CompanyFile[];
  /** Every request raised to the companies (to flag the files that have pending ones). */
  requests?: CorrectionRequest[];
  configured: boolean;
  loadError?: string;
}

const ACTIVE: CompanyFile["status"][] = [
  "SUBMITTED",
  "IN_REVIEW",
  "NAME_REJECTED",
  "NAME_APPROVED",
  "INITIAL_APPROVAL",
];

/**
 * "Gestion des sociétés" (Backoffice MAO): every creation file across every
 * société. The submission to the guichet is done by hand — this page is where
 * the MAO team records what the guichet answered, one state at a time:
 * transmitted (in review) → name approved / refused → initial approval →
 * licence issued (on "/backoffice/licences"). A refused file keeps its reason.
 */
export default function AdminSocieteQueue({
  initialSocietes,
  requests = [],
  configured,
  loadError,
}: AdminSocieteQueueProps) {
  const { t, tMessage } = useLanguage();
  const [societes, setSocietes] = useState(initialSocietes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // inline "reason" forms: key = `name:<requestId>` or `file:<companyId>`
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // pending requests per company: to process (answered) / waiting for the company / blocking
  const pendingByCompany = useMemo(() => {
    const m = new Map<string, { answered: number; open: number; blocking: number }>();
    requests.forEach((r) => {
      if (r.status === "CLOTURE") return;
      const cur = m.get(r.company_id) ?? { answered: 0, open: 0, blocking: 0 };
      if (r.status === "REPONDU") cur.answered += 1;
      else cur.open += 1;
      if (r.is_blocking !== false) cur.blocking += 1;
      m.set(r.company_id, cur);
    });
    return m;
  }, [requests]);

  function renderRequestBadge(companyId: string) {
    const p = pendingByCompany.get(companyId);
    if (!p) return null;
    const total = p.answered + p.open;
    return (
      <Link
        href={`/backoffice/demandes?company=${companyId}`}
        title={t("adminRequests.badge.title", { answered: p.answered, open: p.open })}
        className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
          p.answered > 0 ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
        } hover:brightness-95`}
      >
        <span aria-hidden="true">●</span>
        {t("adminRequests.badge.label", { count: total })}
        {p.blocking > 0 && <span className="rounded-full bg-white/70 px-1.5">{t("adminRequests.badge.blocking")}</span>}
      </Link>
    );
  }

  const active = useMemo(
    () =>
      societes
        .filter((s) => ACTIVE.indexOf(s.status) !== -1)
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at)),
    [societes]
  );
  const drafts = useMemo(
    () =>
      societes
        .filter((s) => s.status === "DRAFT")
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [societes]
  );
  const closed = useMemo(
    () =>
      societes
        .filter((s) => s.status === "LICENCE_ISSUED" || s.status === "REJECTED")
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [societes]
  );

  function run(id: string, action: () => Promise<ActionResult<CompanyFile>>, onDone?: () => void) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPendingId(id);
    startTransition(async () => {
      const result = await action();
      setPendingId(null);
      if (!result.success || !result.data) {
        setErrors((prev) => ({ ...prev, [id]: tMessage(firstIssueMessage(t, result, t("admin.societes.error"))) ?? "" }));
        return;
      }
      setSocietes((prev) => prev.map((s) => (s.id === id ? result.data! : s)));
      onDone?.();
    });
  }

  function confirmReason(company: CompanyFile, key: string, nameId?: string) {
    const trimmed = reason.trim();
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, [company.id]: t("admin.societes.error.reasonRequired") }));
      return;
    }
    run(
      company.id,
      () =>
        nameId ? rejectCompanyName(company.id, nameId, trimmed) : rejectCompany(company.id, trimmed),
      () => {
        setReasonFor(null);
        setReason("");
      }
    );
    void key;
  }

  if (!configured) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {t("admin.societes.heading")}
        </h1>
        <p className="text-sm text-neutral-500">{loadError ?? "Supabase n'est pas configuré."}</p>
      </div>
    );
  }

  const primaryBtn =
    "rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60";
  const dangerBtn =
    "rounded-full border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-60";

  function renderReasonForm(company: CompanyFile, key: string, nameId?: string) {
    const busy = isPending && pendingId === company.id;
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
        <label className="text-sm font-medium text-red-800">
          {nameId ? t("company.backoffice.nameReject.reason") : t("admin.societes.reject.reason.label")}
        </label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("admin.societes.reject.reason.placeholder")}
          className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-red-400"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => confirmReason(company, key, nameId)}
            disabled={busy}
            className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {busy ? t("admin.societes.rejecting") : t("admin.societes.reject.confirm")}
          </button>
          <button
            type="button"
            onClick={() => {
              setReasonFor(null);
              setReason("");
            }}
            disabled={busy}
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-100"
          >
            {t("admin.societes.reject.cancel")}
          </button>
        </div>
      </div>
    );
  }

  function renderNames(company: CompanyFile, busy: boolean) {
    const canDecide = company.status === "IN_REVIEW";
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
          {t("admin.societes.names.label")}
        </span>
        {company.names.map((n: CompanyNameRequest) => {
          const issues = n.status === "PENDING" ? validateTradeName(n.proposed_name) : [];
          const key = `name:${n.id}`;
          return (
            <div key={n.id} className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-neutral-800">
                  <span className="text-xs font-semibold text-neutral-400">#{n.rank}</span>{" "}
                  <span className="font-semibold">{n.proposed_name}</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                    n.status === "APPROVED"
                      ? "bg-emerald-100 text-emerald-700"
                      : n.status === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {t(`company.name.status.${n.status}`)}
                </span>
              </div>
              {issues.length > 0 && (
                <ul className="text-xs text-amber-700">
                  {issues.map((i) => (
                    <li key={i.code}>⚠ {issueMessage(t, i)}</li>
                  ))}
                </ul>
              )}
              {n.status === "REJECTED" && n.rejection_reason && (
                <span className="text-xs text-red-700">{n.rejection_reason}</span>
              )}
              {canDecide && n.status === "PENDING" && reasonFor !== key && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(company.id, () => approveCompanyName(company.id, n.id))}
                    className="rounded-full bg-[#7a9a5a] px-4 py-1.5 text-xs font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
                  >
                    {t("company.backoffice.name.approve")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setReason("");
                      setReasonFor(key);
                    }}
                    className="rounded-full border border-red-300 bg-red-50 px-4 py-1.5 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    {t("company.backoffice.name.reject")}
                  </button>
                </div>
              )}
              {reasonFor === key && renderReasonForm(company, key, n.id)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {t("admin.societes.heading")}
        </h1>
        <p className="max-w-xl text-sm text-neutral-600">{t("admin.societes.intro")}</p>
      </div>

      {loadError && <p className="text-sm text-red-500">{loadError}</p>}

      {active.length === 0 ? (
        <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">
          {t("admin.societes.empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((company) => {
            const busy = isPending && pendingId === company.id;
            const error = errors[company.id];
            const fileKey = `file:${company.id}`;
            return (
              <div
                key={company.id}
                className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                      {t("admin.societes.tracking.label")}: {company.tracking_reference ?? "—"}
                    </span>
                    <Link href={`/backoffice/societes/${company.id}`} className="text-sm font-bold text-neutral-900 hover:underline">
                      {companyDisplayName(company) ?? t("company.draft.untitled")} <span className="text-xs font-semibold text-[#4f7a37]">· {t("dossier.open")} →</span>
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {renderRequestBadge(company.id)}
                    <span
                      className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClasses(
                        company.status
                      )}`}
                    >
                      {t(`status.${company.status}`)}
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-2 text-xs text-neutral-500 sm:grid-cols-3">
                  <div>
                    <dt className="font-semibold text-neutral-400">{t("company.about.authority")}</dt>
                    <dd>
                      {company.authority?.name ?? "—"} ·{" "}
                      {company.jurisdiction_type ? t(`jurisdiction.${company.jurisdiction_type}`) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-400">{t("company.about.legalForm")}</dt>
                    <dd>
                      {company.legal_form?.label ?? "—"} · {company.licence_type?.label ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-400">{t("admin.societes.requester.label")}</dt>
                    <dd>{company.requester_name ?? t("societe.requester.unknown")}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-400">{t("company.pay.total")}</dt>
                    <dd>{company.payment ? formatAed(Number(company.payment.total_aed)) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-400">{t("home.about.createdAt.label")}</dt>
                    <dd>{formatDateTime(company.created_at)}</dd>
                  </div>
                </dl>

                {company.names.length > 0 && renderNames(company, busy)}

                {error && <p className="text-sm text-red-500">{error}</p>}

                {reasonFor === fileKey ? (
                  renderReasonForm(company, fileKey)
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {company.status === "SUBMITTED" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(company.id, () => startCompanyReview(company.id))}
                        className={primaryBtn}
                      >
                        {busy ? t("admin.societes.validating") : t("company.backoffice.startReview")}
                      </button>
                    )}
                    {company.status === "NAME_APPROVED" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(company.id, () => grantCompanyInitialApproval(company.id))}
                        className={primaryBtn}
                      >
                        {busy ? t("admin.societes.validating") : t("company.backoffice.initialApproval")}
                      </button>
                    )}
                    {company.status === "NAME_REJECTED" && (
                      <span className="text-xs text-neutral-500">{t("company.backoffice.waitingNames")}</span>
                    )}
                    {company.status === "INITIAL_APPROVAL" && (
                      <Link href="/backoffice/licences" className="text-sm font-bold text-[#4f7a37] hover:underline">
                        {t("company.backoffice.toLicences")} →
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setReason("");
                        setReasonFor(fileKey);
                      }}
                      className={dangerBtn}
                    >
                      {t("admin.societes.reject")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">{t("admin.societes.drafts.title")}</h2>
        <p className="text-xs text-neutral-500">{t("admin.societes.drafts.intro")}</p>
        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">
            {t("admin.societes.drafts.empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {drafts.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-0.5">
                  <Link href={`/backoffice/societes/${d.id}`} className="text-sm font-bold text-neutral-900 hover:underline">
                    {companyDisplayName(d) ?? t("company.draft.untitled")} <span className="text-xs font-semibold text-[#4f7a37]">· {t("dossier.open")} →</span>
                  </Link>
                  <span className="text-xs text-neutral-500">
                    {d.requester_name ?? t("societe.requester.unknown")} · {formatDateTime(d.updated_at)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderRequestBadge(d.id)}
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClasses(d.status)}`}>
                    {t(`status.${d.status}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">{t("admin.societes.history.title")}</h2>
        {closed.length === 0 ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">
            {t("admin.societes.history.empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {closed.map((s) => (
              <div key={s.id} className="flex flex-col gap-2 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                      {t("admin.societes.tracking.label")}: {s.tracking_reference ?? "—"}
                    </span>
                    <Link href={`/backoffice/societes/${s.id}`} className="text-sm font-bold text-neutral-900 hover:underline">
                      {companyDisplayName(s) ?? t("company.draft.untitled")} <span className="text-xs font-semibold text-[#4f7a37]">· {t("dossier.open")} →</span>
                    </Link>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClasses(
                      s.status
                    )}`}
                  >
                    {t(`status.${s.status}`)}
                  </span>
                </div>
                <dl className="grid grid-cols-1 gap-2 text-xs text-neutral-500 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-neutral-400">{t("admin.societes.requester.label")}</dt>
                    <dd>{s.requester_name ?? t("societe.requester.unknown")}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-400">{t("home.about.status.history.title")}</dt>
                    <dd>{formatDateTime(s.updated_at)}</dd>
                  </div>
                </dl>
                {s.status === "REJECTED" && s.rejection_reason && (
                  <p className="whitespace-pre-wrap rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {s.rejection_reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
