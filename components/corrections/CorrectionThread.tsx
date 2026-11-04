"use client";

import { useState } from "react";
import { useLanguage } from "../LanguageProvider";
import { answerCorrection } from "@/app/actions/corrections";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_SIZE_BYTES,
  VISA_DOCUMENTS_BUCKET,
} from "@/lib/storage";
import type { CorrectionFile, CorrectionRequest } from "@/lib/correction";

export const CORRECTION_BADGE: Record<CorrectionRequest["status"], string> = {
  OUVERT: "bg-amber-100 text-amber-700",
  REPONDU: "bg-sky-100 text-sky-700",
  CLOTURE: "bg-emerald-100 text-emerald-700",
};

export function FileLinks({ files }: { files: CorrectionFile[] }) {
  if (!files || files.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.url}>
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#d7e0cc] bg-[#f8faf5] px-3 py-1 text-xs font-semibold text-[#4f7a37] hover:underline"
          >
            📎 {f.name}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** One correction: what MAO asked, and (when answered) what the company replied. */
export function CorrectionBody({ c }: { c: CorrectionRequest }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-neutral-500">
          {c.reference} · {t(`correction.section.${c.section}`)} · {new Date(c.created_at).toLocaleDateString()}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${CORRECTION_BADGE[c.status]}`}>
          {t(`correction.status.${c.status}`)}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-neutral-900">{c.message}</p>
      {c.is_blocking === false && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          <span className="font-bold">{t("correction.waiver.badge")}</span>
          {c.waiver_reason ? ` — ${c.waiver_reason}` : ""}
        </div>
      )}
      {(c.response || c.response_files.length > 0) && (
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
            {t("correction.response.label")}
          </span>
          {c.response && <p className="whitespace-pre-wrap text-sm text-neutral-800">{c.response}</p>}
          <FileLinks files={c.response_files} />
        </div>
      )}
    </div>
  );
}

interface ThreadProps {
  corrections: CorrectionRequest[];
  /** "company" files go to the documents bucket, "visa" ones to the visa bucket. */
  kind: "company" | "visa";
  companyId: string;
  onChange?: (updated: CorrectionRequest) => void;
  /** Hide the whole block when there is nothing to show. */
  hideWhenEmpty?: boolean;
  /** Overrides of the block heading (defaults: the generic corrections ones). */
  titleKey?: string;
  introKey?: string;
}

/**
 * Company side: the requests MAO sent, with a form to answer each open one
 * (text and/or attachments). MAO closes the request once satisfied.
 */
export default function CorrectionThread({ corrections, kind, companyId, onChange, hideWhenEmpty = true, titleKey, introKey }: ThreadProps) {
  const { t, tMessage } = useLanguage();
  const [rows, setRows] = useState(corrections);
  const [text, setText] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (rows.length === 0 && hideWhenEmpty) return null;

  const sorted = [...rows].sort((a, b) => {
    const rank = (c: CorrectionRequest) => (c.status === "OUVERT" ? 0 : c.status === "REPONDU" ? 1 : 2);
    return rank(a) - rank(b) || b.created_at.localeCompare(a.created_at);
  });

  function setError(id: string, msg: string | null) {
    setErrors((prev) => {
      const next = { ...prev };
      if (msg) next[id] = msg;
      else delete next[id];
      return next;
    });
  }

  function pick(id: string, list: FileList | null) {
    if (!list) return;
    setError(id, null);
    const picked = Array.from(list);
    for (const f of picked) {
      if (ALLOWED_DOCUMENT_TYPES.indexOf(f.type) === -1) return setError(id, t("correction.upload.error.type", { name: f.name }));
      if (f.size > MAX_DOCUMENT_SIZE_BYTES) return setError(id, t("correction.upload.error.size", { name: f.name }));
    }
    setFiles((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), ...picked] }));
  }

  async function send(c: CorrectionRequest) {
    setError(c.id, null);
    const picked = files[c.id] ?? [];
    setBusy(c.id);
    try {
      const uploaded: CorrectionFile[] = [];
      if (picked.length > 0) {
        if (!isSupabaseConfigured()) return setError(c.id, t("correction.upload.error.config"));
        const supabase = getSupabaseClient();
        const bucket = kind === "visa" ? VISA_DOCUMENTS_BUCKET : DOCUMENTS_BUCKET;
        for (const f of picked) {
          const safe = f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
          const path = `${companyId}/corrections/${c.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
          const up = await supabase.storage.from(bucket).upload(path, f, { upsert: false });
          if (up.error) return setError(c.id, t("correction.upload.error.upload", { name: f.name, error: up.error.message }));
          uploaded.push({ name: f.name, size: f.size, url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl });
        }
      }
      const result = await answerCorrection(c.id, text[c.id] ?? "", uploaded);
      if (!result.success || !result.data) {
        const code = result.issues?.[0]?.code;
        return setError(c.id, code ? t(`correction.issue.${code}`) : (tMessage(result.error) ?? ""));
      }
      setRows((prev) => prev.map((x) => (x.id === c.id ? result.data! : x)));
      setFiles((prev) => ({ ...prev, [c.id]: [] }));
      onChange?.(result.data);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-bold text-neutral-900">{t(titleKey ?? "correction.title")}</h2>
        <p className="text-xs text-neutral-500">{t(introKey ?? "correction.intro")}</p>
      </div>
      {rows.length === 0 && <p className="text-sm text-neutral-500">{t("correction.empty")}</p>}
      {sorted.map((c) => (
        <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-white p-4">
          <CorrectionBody c={c} />
          {c.status === "OUVERT" && (
            <div className="flex flex-col gap-2">
              <textarea
                rows={3}
                value={text[c.id] ?? ""}
                onChange={(e) => setText({ ...text, [c.id]: e.target.value })}
                placeholder={t("correction.answer.placeholder")}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[#7a9a5a]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100">
                  {t("correction.answer.attach")}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      pick(c.id, e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {(files[c.id] ?? []).map((f, i) => (
                  <span key={`${f.name}-${i}`} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                    {f.name}
                    <button
                      type="button"
                      aria-label={t("correction.answer.remove")}
                      className="ml-1 text-neutral-400 hover:text-red-600"
                      onClick={() => setFiles((prev) => ({ ...prev, [c.id]: (prev[c.id] ?? []).filter((_, j) => j !== i) }))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {errors[c.id] && <p className="text-sm text-red-600">{errors[c.id]}</p>}
              <button
                type="button"
                disabled={busy === c.id}
                onClick={() => send(c)}
                className="w-fit rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
              >
                {busy === c.id ? t("correction.answer.sending") : t("correction.answer.send")}
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
