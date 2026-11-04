"use client";

import { useState, useTransition } from "react";
import { useLanguage } from "../LanguageProvider";
import { decideProfileChangeRequest } from "@/app/actions/profile-requests";
import type { ProfileChangeRequest } from "@/lib/profile-request";
import { RequestedSummary } from "../profile/ProfileInfoCard";

interface Props {
  requests: ProfileChangeRequest[];
  configured: boolean;
  loadError?: string;
}

const BADGE: Record<ProfileChangeRequest["status"], string> = {
  ouvert: "bg-amber-100 text-amber-700",
  approuve: "bg-emerald-100 text-emerald-700",
  refuse: "bg-red-100 text-red-700",
};

/** "Demandes de profil": every profile change request, processed by the MAO team. */
export default function AdminProfileQueue({ requests, configured, loadError }: Props) {
  const { t, tMessage } = useLanguage();
  const [rows, setRows] = useState(requests);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = rows.filter((r) => r.status === "ouvert");
  const done = rows.filter((r) => r.status !== "ouvert");

  function decide(r: ProfileChangeRequest, approve: boolean) {
    setError(null);
    setBusyId(r.id);
    startTransition(async () => {
      const res = await decideProfileChangeRequest(r.id, approve, comments[r.id]);
      setBusyId(null);
      if (!res.success || !res.data) {
        const code = res.issues?.[0]?.code;
        setError(code ? t(`profile.request.issue.${code}`) : (tMessage(res.error) ?? ""));
        return;
      }
      setRows((prev) => prev.map((x) => (x.id === r.id ? res.data! : x)));
    });
  }

  function card(r: ProfileChangeRequest, withActions: boolean) {
    const cur = r.current_values;
    return (
      <div key={r.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-neutral-900">
              {`${cur.first_name ?? ""} ${cur.last_name ?? ""}`.trim() || r.user_email || r.user_id}
            </span>
            <span className="text-xs text-neutral-500">
              {r.reference} · {r.user_email ?? "—"}
              {r.company_name ? ` · ${r.company_name}` : ""}
            </span>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${BADGE[r.status]}`}>
            {t(`profile.request.status.${r.status}`)}
          </span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{t("admin.profiles.requested")}</p>
          <RequestedSummary values={r.requested_values} />
        </div>
        {r.reason && <p className="whitespace-pre-wrap text-sm text-neutral-700">{r.reason}</p>}
        {r.decision_comment && <p className="text-xs text-neutral-500">{r.decision_comment}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
          <span>{new Date(r.created_at).toLocaleString()}</span>
        </div>
        {withActions && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={comments[r.id] ?? ""}
              onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })}
              placeholder={t("admin.profiles.comment")}
              className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[#7a9a5a]"
            />
            <button
              type="button"
              disabled={isPending && busyId === r.id}
              onClick={() => decide(r, true)}
              className="rounded-full bg-[#7a9a5a] px-5 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
            >
              {t("admin.profiles.approve")}
            </button>
            <button
              type="button"
              disabled={isPending && busyId === r.id}
              onClick={() => decide(r, false)}
              className="rounded-full border border-red-300 px-5 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              {t("admin.profiles.refuse")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">{t("admin.profiles.heading")}</h1>
        <p className="max-w-xl text-sm text-neutral-600">{t("admin.profiles.intro")}</p>
      </div>
      {!configured && <p className="text-sm text-red-500">{t("admin.profiles.noConfig")}</p>}
      {loadError && <p className="text-sm text-red-500">{loadError}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">{t("admin.profiles.open")}</h2>
        {open.length === 0 ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">{t("admin.profiles.open.empty")}</div>
        ) : (
          open.map((r) => card(r, true))
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">{t("admin.profiles.done")}</h2>
        {done.length === 0 ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-500 sm:p-8">{t("admin.profiles.done.empty")}</div>
        ) : (
          done.map((r) => card(r, false))
        )}
      </div>
    </div>
  );
}
