"use client";

import { useState, useTransition } from "react";
import { useLanguage } from "../LanguageProvider";
import { closeCorrection, raiseCorrection } from "@/app/actions/corrections";
import { sectionsFor, type CorrectionRequest, type CorrectionSection } from "@/lib/correction";
import { CorrectionBody } from "./CorrectionThread";
import WaiverControl from "./WaiverControl";

interface Props {
  companyId: string;
  /** Set for a visa application: the sections offered are the visa ones. */
  visaId?: string | null;
  initial: CorrectionRequest[];
}

/**
 * Backoffice side: raise an inconsistency / an additional request towards the
 * company, follow the answers and close each request once it is satisfied.
 */
export default function CorrectionManager({ companyId, visaId, initial }: Props) {
  const { t, tMessage } = useLanguage();
  const sections = sectionsFor(Boolean(visaId));
  const [rows, setRows] = useState(initial);
  const [section, setSection] = useState<CorrectionSection>(sections[0]);
  const [message, setMessage] = useState("");
  const [nonBlocking, setNonBlocking] = useState(false);
  const [waiverReason, setWaiverReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fail(res: { error?: string; issues?: { code: string }[] }) {
    const code = res.issues?.[0]?.code;
    setError(code ? t(`correction.issue.${code}`) : (tMessage(res.error) ?? ""));
  }

  function raise() {
    setError(null);
    setBusyId("new");
    startTransition(async () => {
      const res = await raiseCorrection({ companyId, visaId: visaId ?? null, section, message, nonBlockingReason: nonBlocking ? waiverReason : null });
      setBusyId(null);
      if (!res.success || !res.data) return fail(res);
      setRows((prev) => [res.data!, ...prev]);
      setMessage("");
      setNonBlocking(false);
      setWaiverReason("");
    });
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

  const pending = rows.filter((r) => r.status !== "CLOTURE" && r.is_blocking !== false).length;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">{t("correction.manager.title")}</h2>
          <p className="text-xs text-neutral-500">{t("correction.manager.intro")}</p>
        </div>
        {pending > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
            {t("correction.manager.pending", { count: pending })}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4">
        <span className="text-sm font-bold text-neutral-900">{t("correction.manager.new")}</span>
        <select
          value={section}
          onChange={(e) => setSection(e.target.value as CorrectionSection)}
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#7a9a5a]"
        >
          {sections.map((s) => (
            <option key={s} value={s}>
              {t(`correction.section.${s}`)}
            </option>
          ))}
        </select>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("correction.manager.placeholder")}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[#7a9a5a]"
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
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[#7a9a5a]"
          />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={isPending && busyId === "new"}
          onClick={raise}
          className="w-fit rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
        >
          {isPending && busyId === "new" ? t("correction.manager.sending") : t("correction.manager.send")}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("correction.manager.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-neutral-100 p-4">
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
    </section>
  );
}
