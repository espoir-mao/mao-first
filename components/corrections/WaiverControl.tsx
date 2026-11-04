"use client";

import { useState, useTransition } from "react";
import { useLanguage } from "../LanguageProvider";
import { waiveCorrection } from "@/app/actions/corrections";
import type { CorrectionRequest } from "@/lib/correction";

/** MAO: waive a pending request (it stops blocking), with a mandatory explanation. */
export default function WaiverControl({
  correction,
  onChanged,
}: {
  correction: CorrectionRequest;
  onChanged: (updated: CorrectionRequest) => void;
}) {
  const { t, tMessage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (correction.status === "CLOTURE" || !correction.is_blocking) return null;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await waiveCorrection(correction.id, reason);
      if (!res.success || !res.data) {
        const code = res.issues?.[0]?.code;
        setError(code ? t(`correction.issue.${code}`) : (tMessage(res.error) ?? ""));
        return;
      }
      setOpen(false);
      setReason("");
      onChanged(res.data);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-100"
      >
        {t("correction.waiver.open")}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs text-neutral-600">{t("correction.waiver.help")}</p>
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("correction.waiver.placeholder")}
        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#7a9a5a]"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="rounded-full bg-[#7a9a5a] px-4 py-2 text-xs font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
        >
          {t("correction.waiver.confirm")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100">
          {t("correction.waiver.cancel")}
        </button>
      </div>
    </div>
  );
}
