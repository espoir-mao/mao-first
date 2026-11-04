"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useLanguage } from "../LanguageProvider";
import { closeCorrection, raiseCorrection } from "@/app/actions/corrections";
import { COMPANY_SECTIONS, type CorrectionRequest, type CorrectionSection } from "@/lib/correction";
import type { CompanyFile } from "@/lib/company-types";
import { companyDisplayName } from "@/lib/company-view";
import { CorrectionBody } from "../corrections/CorrectionThread";
import WaiverControl from "../corrections/WaiverControl";

interface Props {
  requests: CorrectionRequest[];
  companies: CompanyFile[];
  /** Opened from a company's notification: only its requests. */
  initialCompanyId?: string;
  /** The hub already shows the page heading. */
  hideHeading?: boolean;
  configured: boolean;
  loadError?: string;
}

type Filter = "TODO" | "WAITING" | "CLOSED" | "ALL";

/**
 * Backoffice MAO > Gestion de demandes: every request MAO made to the
 * companies (on the file or on a visa), whatever the company. Answered ones
 * wait for MAO to close them; open ones wait for the company.
 */
export default function AdminRequestQueue({ requests, companies, initialCompanyId, hideHeading, configured, loadError }: Props) {
  const { t, tMessage } = useLanguage();
  const [rows, setRows] = useState(requests);
  const [filter, setFilter] = useState<Filter>(initialCompanyId ? "ALL" : "TODO");
  const [companyFilter, setCompanyFilter] = useState<string | null>(initialCompanyId ?? null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [newCompany, setNewCompany] = useState("");
  const [newSection, setNewSection] = useState<CorrectionSection>(COMPANY_SECTIONS[0]);
  const [newMessage, setNewMessage] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [nonBlocking, setNonBlocking] = useState(false);
  const [waiverReason, setWaiverReason] = useState("");

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    companies.forEach((c) => m.set(c.id, companyDisplayName(c) ?? t("company.draft.untitled")));
    return (id: string) => m.get(id) ?? "—";
  }, [companies, t]);

  const todo = rows.filter((r) => r.status === "REPONDU").length;
  const waiting = rows.filter((r) => r.status === "OUVERT").length;
  const closed = rows.filter((r) => r.status === "CLOTURE").length;

  const shown = rows
    .filter((r) =>
      filter === "ALL" ? true : filter === "TODO" ? r.status === "REPONDU" : filter === "WAITING" ? r.status === "OUVERT" : r.status === "CLOTURE"
    )
    .filter((r) => !companyFilter || r.company_id === companyFilter)
    .filter((r) => {
      const q = search.trim().toLowerCase();
      return !q || `${nameOf(r.company_id)} ${r.reference} ${r.message}`.toLowerCase().indexOf(q) !== -1;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  function fail(res: { error?: string; issues?: { code: string }[] }) {
    const code = res.issues?.[0]?.code;
    setError(code ? t(`correction.issue.${code}`) : (tMessage(res.error) ?? ""));
  }

  function close(c: CorrectionRequest) {
    setError(null);
    setBusyId(c.id);
    startTransition(async () => {
      const res = await closeCorrection(c.id);
      setBusyId(null);
      if (!res.success || !res.data) return fail(res);
      setRows((prev) => prev.map((x) => (x.id === c.id ? res.data! : x)));
    });
  }

  function raise() {
    setError(null);
    setBusyId("new");
    startTransition(async () => {
      const res = await raiseCorrection({ companyId: newCompany, section: newSection, message: newMessage, nonBlockingReason: nonBlocking ? waiverReason : null });
      setBusyId(null);
      if (!res.success || !res.data) return fail(res);
      setRows((prev) => [res.data!, ...prev]);
      setNewMessage("");
      setNonBlocking(false);
      setWaiverReason("");
      setShowNew(false);
      setFilter("WAITING");
    });
  }

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "TODO", label: t("adminRequests.tab.todo"), count: todo },
    { id: "WAITING", label: t("adminRequests.tab.waiting"), count: waiting },
    { id: "CLOSED", label: t("adminRequests.tab.closed"), count: closed },
    { id: "ALL", label: t("adminRequests.tab.all"), count: rows.length },
  ];

  const inputCls = "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#7a9a5a]";

  return (
    <div className="flex flex-col gap-6">
      {!hideHeading && (
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">{t("adminRequests.heading")}</h1>
          <p className="max-w-xl text-sm text-neutral-600">{t("adminRequests.intro")}</p>
        </div>
      )}

      {(!configured || loadError) && <p className="text-sm text-red-500">{loadError ?? t("administration.loadError")}</p>}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("adminRequests.stat.todo"), value: todo, tone: "text-sky-700" },
          { label: t("adminRequests.stat.waiting"), value: waiting, tone: "text-amber-700" },
          { label: t("adminRequests.stat.closed"), value: closed, tone: "text-emerald-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-neutral-100 bg-white px-4 py-3">
            <div className={`text-2xl font-extrabold ${s.tone}`}>{s.value}</div>
            <div className="text-xs text-neutral-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              aria-pressed={filter === tab.id}
              className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                filter === tab.id ? "border-[#7a9a5a] bg-spring-50 text-[#3f5029]" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("adminRequests.search")}
            className={`${inputCls} w-48`}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="rounded-full bg-[#7a9a5a] px-4 py-2 text-xs font-extrabold text-[#0d0f0c] transition hover:brightness-95"
          >
            {t("adminRequests.new")}
          </button>
        </div>
      </div>

      {showNew && (
        <section className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
          <select value={newCompany} onChange={(e) => setNewCompany(e.target.value)} className={inputCls}>
            <option value="">{t("adminRequests.new.company")}</option>
            {companies
              .filter((c) => c.status !== "DRAFT")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {companyDisplayName(c) ?? t("company.draft.untitled")}
                </option>
              ))}
          </select>
          <select value={newSection} onChange={(e) => setNewSection(e.target.value as CorrectionSection)} className={inputCls}>
            {COMPANY_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`correction.section.${s}`)}
              </option>
            ))}
          </select>
          <textarea
            rows={3}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t("correction.manager.placeholder")}
            className={inputCls}
          />
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={nonBlocking} onChange={(e) => setNonBlocking(e.target.checked)} />
            {t("correction.waiver.raiseNonBlocking")}
          </label>
          {nonBlocking && (
            <textarea
              rows={2}
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
              placeholder={t("correction.waiver.placeholder")}
              className={inputCls}
            />
          )}
          <button
            type="button"
            disabled={!newCompany || (isPending && busyId === "new")}
            onClick={raise}
            className="w-fit rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
          >
            {isPending && busyId === "new" ? t("correction.manager.sending") : t("correction.manager.send")}
          </button>
        </section>
      )}

      {companyFilter && (
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-spring-50 px-3 py-1 font-bold text-[#3f5029]">{nameOf(companyFilter)}</span>
          <button type="button" onClick={() => setCompanyFilter(null)} className="text-xs font-bold text-neutral-500 underline-offset-2 hover:underline">
            {t("adminRequests.clearCompany")}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500">{t("adminRequests.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/backoffice/societes/${c.company_id}`} className="font-bold text-neutral-900 hover:underline">
                  {nameOf(c.company_id)}
                </Link>
                {c.visa_application_id && (
                  <Link href={`/backoffice/visas/${c.visa_application_id}`} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-600 hover:underline">
                    {t("adminRequests.visaLink")}
                  </Link>
                )}
              </div>
              <CorrectionBody c={c} />
              <WaiverControl correction={c} onChanged={(u) => setRows((prev) => prev.map((x) => (x.id === u.id ? u : x)))} />
              {c.status !== "CLOTURE" && (
                <button
                  type="button"
                  disabled={isPending && busyId === c.id}
                  onClick={() => close(c)}
                  className="w-fit rounded-full border border-[#7a9a5a] px-4 py-2 text-xs font-bold text-[#4f7a37] transition hover:bg-[#f2f6ec] disabled:opacity-60"
                >
                  {c.status === "REPONDU" ? t("correction.manager.close") : t("correction.manager.withdraw")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
