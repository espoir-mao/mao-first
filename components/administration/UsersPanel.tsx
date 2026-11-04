"use client";

import { useEffect, useState, useTransition } from "react";
import type { User } from "@supabase/supabase-js";
import {
  PERMISSION_SECTIONS,
  type PermissionSection,
  type CompanyUser,
  type CompanyUserPermissions,
} from "@/lib/types";
import { useActiveSociete } from "@/lib/active-societe";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { getUserDisplayName } from "@/lib/profile";
import {
  addCompanyUser,
  listCompanyUsers,
  removeCompanyUser,
  updateCompanyUserPermissions,
} from "@/app/actions/company-users";
import NoSociete from "./NoSociete";
import { useLanguage } from "../LanguageProvider";

function emptyPermissions(): CompanyUserPermissions {
  const out = {} as CompanyUserPermissions;
  for (const s of PERMISSION_SECTIONS) out[s] = { read: false, write: false };
  return out;
}

interface RightsGridProps {
  value: CompanyUserPermissions;
  disabled?: boolean;
  onToggle: (section: PermissionSection, kind: "read" | "write", checked: boolean) => void;
}

/** One row of Lecture / Écriture checkboxes per section. */
function RightsGrid({ value, disabled, onToggle }: RightsGridProps) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {PERMISSION_SECTIONS.map((section) => (
        <fieldset
          key={section}
          className="flex flex-col gap-1.5 rounded-xl bg-neutral-50 px-3 py-2.5"
        >
          <legend className="sr-only">{t(`administration.section.${section}`)}</legend>
          <span className="text-xs font-bold text-neutral-700">
            {t(`administration.section.${section}`)}
          </span>
          {(["read", "write"] as const).map((kind) => (
            <label
              key={kind}
              className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600"
            >
              <input
                type="checkbox"
                checked={value[section][kind]}
                disabled={disabled}
                onChange={(e) => onToggle(section, kind, e.target.checked)}
                className="h-3.5 w-3.5 accent-[#7a9a5a]"
              />
              {t(`administration.users.${kind}`)}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

/**
 * "Administration > Utilisateurs": the société manager adds/removes users
 * and edits their read/write rights per section (société, visa, support,
 * comptabilité, admin). Demo-only: the rights are stored but not enforced
 * elsewhere in the app yet — the page says so.
 */
export default function UsersPanel({ configured }: { configured: boolean }) {
  const { t } = useLanguage();
  const { activeSociete, mounted } = useActiveSociete();
  const societeId = activeSociete?.id ?? null;

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isAdding, startAdding] = useTransition();
  const [, startMutating] = useTransition();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rights, setRights] = useState<CompanyUserPermissions>(emptyPermissions);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => setOwner(data.session?.user ?? null));
  }, []);

  useEffect(() => {
    if (!societeId) return;
    let cancelled = false;
    setLoadError(null);
    listCompanyUsers(societeId).then((result) => {
      if (cancelled) return;
      if (result.success) setUsers(result.data ?? []);
      else setLoadError(result.error ?? t("administration.loadError"));
    });
    return () => {
      cancelled = true;
    };
    // `t` is stable per language; only reload when the société changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [societeId]);

  function toggleNew(section: PermissionSection, kind: "read" | "write", checked: boolean) {
    setRights((prev) => ({ ...prev, [section]: { ...prev[section], [kind]: checked } }));
  }

  function toggleExisting(
    user: CompanyUser,
    section: PermissionSection,
    kind: "read" | "write",
    checked: boolean
  ) {
    if (!societeId) return;
    const next: CompanyUserPermissions = {
      ...user.permissions,
      [section]: { ...user.permissions[section], [kind]: checked },
    };
    setError(null);
    setBusyId(user.id);
    startMutating(async () => {
      const result = await updateCompanyUserPermissions(user.id, societeId, next);
      if (result.success && result.data) {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? result.data! : u)));
      } else {
        setError(result.error ?? t("administration.loadError"));
      }
      setBusyId(null);
    });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!societeId) return;
    setError(null);
    startAdding(async () => {
      const result = await addCompanyUser(societeId, { name, email, permissions: rights });
      if (result.success && result.data) {
        setUsers((prev) => [...prev, result.data!]);
        setName("");
        setEmail("");
        setRights(emptyPermissions());
      } else {
        setError(result.error ?? t("administration.loadError"));
      }
    });
  }

  function handleRemove(user: CompanyUser) {
    if (!societeId) return;
    setError(null);
    setBusyId(user.id);
    startMutating(async () => {
      const result = await removeCompanyUser(user.id, societeId);
      if (result.success) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        setConfirmId(null);
      } else {
        setError(result.error ?? t("administration.loadError"));
      }
      setBusyId(null);
    });
  }

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800 outline-none focus:border-[#7a9a5a]";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {t("administration.users.heading")}
        </h1>
        <p className="max-w-xl text-sm text-neutral-600">
          {t("administration.users.intro")}
        </p>
        <p className="max-w-xl text-xs text-neutral-500">
          {t("administration.users.note")}
        </p>
      </div>

      {!configured && (
        <p className="text-sm text-red-500">{t("administration.loadError")}</p>
      )}
      {loadError && <p className="text-sm text-red-500">{loadError}</p>}

      {!mounted ? null : !activeSociete ? (
        <NoSociete />
      ) : (
        <>
          {error && <p className="text-sm text-red-500">{error}</p>}

          <section className="rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-base font-bold text-neutral-900">
              {t("administration.users.list.title")}
            </h2>

            <ul className="flex flex-col divide-y divide-neutral-100">
              {owner && (
                <li className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-neutral-900">
                      {getUserDisplayName(owner)}
                    </span>
                    <span className="text-xs text-neutral-500">{owner.email}</span>
                  </div>
                  <span className="rounded-full bg-spring-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#3f5029]">
                    {t("administration.users.owner")}
                  </span>
                </li>
              )}

              {users.map((user) => (
                <li key={user.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-neutral-900">
                        {user.name}
                      </span>
                      <span className="text-xs text-neutral-500">{user.email}</span>
                    </div>
                    {confirmId === user.id ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-neutral-600">
                          {t("administration.users.removeConfirm", { name: user.name })}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === user.id}
                          onClick={() => handleRemove(user)}
                          className="rounded-full bg-red-600 px-3 py-1 font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                        >
                          {t("administration.users.removeYes")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="px-2 py-1 font-bold text-neutral-500 hover:text-neutral-800"
                        >
                          {t("administration.users.removeNo")}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(user.id)}
                        className="rounded-full border border-red-300 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50"
                      >
                        {t("administration.users.remove")}
                      </button>
                    )}
                  </div>
                  <RightsGrid
                    value={user.permissions}
                    disabled={busyId === user.id}
                    onToggle={(section, kind, checked) =>
                      toggleExisting(user, section, kind, checked)
                    }
                  />
                </li>
              ))}
            </ul>

            {users.length === 0 && (
              <p className={`text-sm text-neutral-500 ${owner ? "pt-3" : ""}`}>
                {t("administration.users.empty")}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-base font-bold text-neutral-900">
              {t("administration.users.add.title")}
            </h2>
            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-neutral-600">
                  {t("administration.users.add.name")}
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-neutral-600">
                  {t("administration.users.add.email")}
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-neutral-600">
                  {t("administration.users.add.rights")}
                </span>
                <RightsGrid value={rights} onToggle={toggleNew} />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="rounded-full bg-[#7a9a5a] px-6 py-2.5 text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
                >
                  {isAdding
                    ? t("administration.users.add.submitting")
                    : t("administration.users.add.submit")}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
