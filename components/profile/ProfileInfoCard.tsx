"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "../LanguageProvider";
import { useActiveSociete } from "@/lib/active-societe";
import { getUserFirstName, getUserLastName } from "@/lib/profile";
import {
  createProfileChangeRequest,
  listMyProfileRequests,
} from "@/app/actions/profile-requests";
import {
  HOLDER_STATUSES,
  effectiveProfile,
  type HolderStatus,
  type ProfileChangeRequest,
  type ProfileValues,
} from "@/lib/profile-request";

const STATUS_BADGE: Record<ProfileChangeRequest["status"], string> = {
  ouvert: "bg-amber-100 text-amber-700",
  approuve: "bg-emerald-100 text-emerald-700",
  refuse: "bg-red-100 text-red-700",
};

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]";

/**
 * Personal information with the holder status (manager / shareholder). Nothing
 * is edited directly: "Request a change" files a ticket that the MAO team
 * processes in Backoffice MAO > Demandes de profil. Approved values are shown
 * over the Auth metadata.
 */
export default function ProfileInfoCard({ user }: { user: User }) {
  const { t, tMessage } = useLanguage();
  const { activeSociete } = useActiveSociete();
  const [requests, setRequests] = useState<ProfileChangeRequest[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const base: ProfileValues = {
    first_name: getUserFirstName(user),
    last_name: getUserLastName(user),
    email: user.email ?? "",
  };
  const current = effectiveProfile(base, requests);
  const open = requests.find((r) => r.status === "ouvert");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    holder_status: "" as HolderStatus | "",
    reason: "",
  });

  const reload = useCallback(async () => {
    const r = await listMyProfileRequests(user.id);
    if (r.success) setRequests(r.data ?? []);
  }, [user.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function startEditing() {
    setForm({
      first_name: current.first_name ?? "",
      last_name: current.last_name ?? "",
      email: current.email ?? "",
      holder_status: current.holder_status ?? "",
      reason: "",
    });
    setError(null);
    setSent(null);
    setEditing(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createProfileChangeRequest({
      user_id: user.id,
      user_email: user.email ?? null,
      company_id: activeSociete?.id ?? null,
      company_name: activeSociete?.name ?? null,
      current,
      wanted: {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        holder_status: form.holder_status || undefined,
      },
      reason: form.reason,
    });
    setBusy(false);
    if (!result.success) {
      const code = result.issues?.[0]?.code;
      setError(code ? t(`profile.request.issue.${code}`) : (tMessage(result.error) ?? ""));
      return;
    }
    setEditing(false);
    setSent(result.data?.reference ?? "");
    await reload();
  }

  const statusLabel = current.holder_status
    ? t(`profile.status.${current.holder_status}`)
    : t("profile.status.unset");
  const fullName = `${current.first_name ?? ""} ${current.last_name ?? ""}`.trim();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-neutral-100 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-neutral-900">{t("profile.info.title")}</h2>
          {!editing && !open && (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-full border border-[#7a9a5a] px-4 py-2 text-sm font-bold text-[#4f7a37] transition hover:bg-[#f2f6ec]"
            >
              {t("profile.request.start")}
            </button>
          )}
        </div>

        <dl className="mt-4 flex flex-col gap-3">
          <Row label={t("profile.info.name")} value={fullName || "—"} />
          <Row label={t("profile.info.email")} value={current.email || "—"} />
          <Row label={t("profile.info.status")} value={statusLabel} />
        </dl>

        {open && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t("profile.request.pending", { reference: open.reference })}
          </p>
        )}
        {sent && open && (
          <p className="mt-3 text-xs text-neutral-500">{t("profile.request.sent", { reference: sent })}</p>
        )}
        <p className="mt-4 text-xs text-neutral-400">{t("profile.request.hint")}</p>
      </div>

      {editing && (
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold text-neutral-900">{t("profile.request.title")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-500">
              {t("profile.info.firstName")}
              <input className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-500">
              {t("profile.info.lastName")}
              <input className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-500">
            {t("profile.info.email")}
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-500">
            {t("profile.info.status")}
            <select className={inputCls} value={form.holder_status} onChange={(e) => setForm({ ...form, holder_status: e.target.value as HolderStatus | "" })}>
              <option value="">{t("profile.status.unset")}</option>
              {HOLDER_STATUSES.map((s) => (
                <option key={s} value={s}>{t(`profile.status.${s}`)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-500">
            {t("profile.request.reason")}
            <textarea rows={3} className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
          {error && <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="rounded-full bg-[#7a9a5a] px-6 py-3 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60">
              {busy ? t("profile.request.submitting") : t("profile.request.submit")}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-5 py-3 text-sm font-bold text-[#5b6356] hover:bg-[#f2f6ec]">
              {t("choose.cancel")}
            </button>
          </div>
        </form>
      )}

      {requests.length > 0 && (
        <div className="rounded-2xl border border-neutral-100 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold text-neutral-900">{t("profile.request.history")}</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 rounded-xl border border-neutral-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-neutral-500">{r.reference} · {new Date(r.created_at).toLocaleDateString()}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_BADGE[r.status]}`}>
                    {t(`profile.request.status.${r.status}`)}
                  </span>
                </div>
                <RequestedSummary values={r.requested_values} />
                {r.decision_comment && <p className="text-xs text-neutral-500">{r.decision_comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-sm text-neutral-800">{value}</dd>
    </div>
  );
}

export function RequestedSummary({ values }: { values: ProfileValues }) {
  const { t } = useLanguage();
  const parts: string[] = [];
  if (values.first_name !== undefined) parts.push(`${t("profile.info.firstName")} : ${values.first_name}`);
  if (values.last_name !== undefined) parts.push(`${t("profile.info.lastName")} : ${values.last_name}`);
  if (values.email !== undefined) parts.push(`${t("profile.info.email")} : ${values.email}`);
  if (values.holder_status !== undefined) parts.push(`${t("profile.info.status")} : ${t(`profile.status.${values.holder_status}`)}`);
  return <p className="text-sm text-neutral-800">{parts.join(" · ")}</p>;
}
