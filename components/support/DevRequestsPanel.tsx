"use client";

import { useEffect, useState, useTransition } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { getUserDisplayName } from "@/lib/profile";
import { createDevRequest, updateDevRequestStatus } from "@/app/actions/dev-requests";
import {
  DEV_KINDS,
  DEV_PRIORITIES,
  validateDevRequest,
  type DevRequest,
  type DevStatus,
} from "@/lib/dev-request";
import { useLanguage } from "../LanguageProvider";

interface Props {
  initialRequests: DevRequest[];
  configured: boolean;
  loadError?: string;
}

const STATUS_BADGE: Record<DevStatus, string> = {
  NEW: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  DONE: "bg-emerald-100 text-emerald-700",
  DECLINED: "bg-red-100 text-red-700",
};
const PRIORITY_BADGE = { LOW: "bg-neutral-100 text-neutral-600", NORMAL: "bg-neutral-100 text-neutral-700", HIGH: "bg-red-50 text-red-700" } as const;
const inputCls = "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#7a9a5a]";

/**
 * Backoffice MAO > Support: requests made to the development team — a change
 * to an existing feature, a new feature, or a fix — with their follow-up.
 */
export default function DevRequestsPanel({ initialRequests, configured, loadError }: Props) {
  const { t, tMessage } = useLanguage();
  const [rows, setRows] = useState(initialRequests);
  const [filter, setFilter] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<string>("FEATURE");
  const [priority, setPriority] = useState<string>("NORMAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [me, setMe] = useState<{ name: string | null; email: string | null }>({ name: null, email: null });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        const u = data.session?.user;
        if (u) setMe({ name: getUserDisplayName(u), email: u.email ?? null });
      });
  }, []);

  function fail(res: { error?: string; issues?: { code: string }[] }) {
    const code = res.issues?.[0]?.code;
    setError(code ? t(`dev.issue.${code}`) : (tMessage(res.error) ?? ""));
  }

  function create() {
    setError(null);
    const issues = validateDevRequest({ kind, priority, title, description });
    if (issues.length > 0) return setError(t(`dev.issue.${issues[0]}`));
    setBusy("new");
    startTransition(async () => {
      const res = await createDevRequest({ kind, priority, title, description, requester_name: me.name, requester_email: me.email });
      setBusy(null);
      if (!res.success || !res.data) return fail(res);
      setRows((prev) => [res.data!, ...prev]);
      setTitle("");
      setDescription("");
      setShowForm(false);
      setFilter("OPEN");
    });
  }

  function change(r: DevRequest, status: DevStatus, note = "") {
    setError(null);
    setBusy(r.id);
    startTransition(async () => {
      const res = await updateDevRequestStatus(r.id, status, note || r.dev_comment || "");
      setBusy(null);
      if (!res.success || !res.data) return fail(res);
      setRows((prev) => prev.map((x) => (x.id === r.id ? res.data! : x)));
      setDeclining(null);
      setComment("");
    });
  }

  const open = rows.filter((r) => r.status === "NEW" || r.status === "IN_PROGRESS");
  const shown = rows.filter((r) => (filter === "ALL" ? true : filter === "OPEN" ? open.indexOf(r) !== -1 : open.indexOf(r) === -1));
  const btn = "rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">{t("dev.heading")}</h1>
          <p className="max-w-xl text-sm text-neutral-600">{t("dev.intro")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95"
        >
          {t("dev.new")}
        </button>
      </div>

      {(!configured || loadError) && <p className="text-sm text-red-500">{loadError ?? "Supabase n'est pas configuré."}</p>}

      {showForm && (
        <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-neutral-400">
              {t("dev.kind.label")}
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputCls} font-normal normal-case text-neutral-900`}>
                {DEV_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`dev.kind.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-neutral-400">
              {t("dev.priority.label")}
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={`${inputCls} font-normal normal-case text-neutral-900`}>
                {DEV_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`dev.priority.${p}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("dev.title.placeholder")} className={inputCls} />
          <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("dev.description.placeholder")} className={inputCls} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={isPending && busy === "new"}
            onClick={create}
            className="w-fit rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
          >
            {isPending && busy === "new" ? t("dev.sending") : t("dev.send")}
          </button>
        </section>
      )}

      <div className="flex flex-wrap gap-1.5">
        {([
          ["OPEN", t("dev.filter.open"), open.length],
          ["CLOSED", t("dev.filter.closed"), rows.length - open.length],
          ["ALL", t("dev.filter.all"), rows.length],
        ] as const).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              filter === id ? "border-[#7a9a5a] bg-spring-50 text-[#3f5029]" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {!showForm && error && <p className="text-sm text-red-600">{error}</p>}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500">{t("dev.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                    {r.reference} · {t(`dev.kind.${r.kind}`)}
                  </span>
                  <span className="text-sm font-bold text-neutral-900">{r.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${PRIORITY_BADGE[r.priority]}`}>{t(`dev.priority.${r.priority}`)}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_BADGE[r.status]}`}>{t(`dev.status.${r.status}`)}</span>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-neutral-700">{r.description}</p>
              {r.dev_comment && (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                  <span className="font-bold">{t("dev.comment.label")}</span> — {r.dev_comment}
                </div>
              )}
              <p className="text-xs text-neutral-500">
                {r.requester_name ?? "—"} · {new Date(r.created_at).toLocaleString()}
              </p>

              {declining === r.id ? (
                <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                  <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("dev.decline.placeholder")} className={inputCls} />
                  <div className="flex gap-2">
                    <button type="button" disabled={isPending} onClick={() => change(r, "DECLINED", comment)} className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-extrabold text-white disabled:opacity-60">
                      {t("dev.decline.confirm")}
                    </button>
                    <button type="button" onClick={() => setDeclining(null)} className={btn}>
                      {t("correction.waiver.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {r.status === "NEW" && (
                    <button type="button" disabled={isPending && busy === r.id} onClick={() => change(r, "IN_PROGRESS")} className={btn}>
                      {t("dev.action.start")}
                    </button>
                  )}
                  {(r.status === "NEW" || r.status === "IN_PROGRESS") && (
                    <>
                      <button type="button" disabled={isPending && busy === r.id} onClick={() => change(r, "DONE")} className={btn}>
                        {t("dev.action.done")}
                      </button>
                      <button type="button" onClick={() => { setDeclining(r.id); setComment(""); }} className={btn}>
                        {t("dev.action.decline")}
                      </button>
                    </>
                  )}
                  {(r.status === "DONE" || r.status === "DECLINED") && (
                    <button type="button" disabled={isPending && busy === r.id} onClick={() => change(r, "NEW")} className={btn}>
                      {t("dev.action.reopen")}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
