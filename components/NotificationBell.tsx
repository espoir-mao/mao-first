"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { listNotifications, type AppNotification, type NotificationAudience } from "@/app/actions/notifications";
import { useActiveSociete } from "@/lib/active-societe";
import { BellIcon } from "./Icons";
import { useProfile } from "./ProfileProvider";
import { useLanguage } from "./LanguageProvider";

const POLL_MS = 60_000;

/**
 * Which notifications the bell shows, from the connection profile in use:
 * BACKOFFICE → MAO's notifications (answers and requests coming from the
 * companies); SOCIETE → the active société's notifications only (what MAO asked
 * of THAT company). The server scopes the data by the audience / company given.
 */
export function useNotificationAudience(): { audience: NotificationAudience; companyId: string | null } {
  const { activeSociete } = useActiveSociete();
  const { active } = useProfile();
  if (active === "BACKOFFICE") return { audience: "BACKOFFICE", companyId: null };
  return { audience: "SOCIETE", companyId: activeSociete?.id ?? null };
}

function timeAgo(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const min = Math.round(diff / 60000);
  if (min < 60) return rtf.format(-Math.max(min, 0), "minute");
  const h = Math.round(min / 60);
  if (h < 24) return rtf.format(-h, "hour");
  return rtf.format(-Math.round(h / 24), "day");
}

export default function NotificationBell() {
  const { t, lang } = useLanguage();
  const pathname = usePathname();
  const { audience, companyId } = useNotificationAudience();
  const { user } = useProfile();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    listNotifications({ audience, companyId }).then((r) => {
      if (r.success) setItems(r.data ?? []);
    });
  }, [audience, companyId]);

  // refresh on mount, when the audience / société / page changes, and every minute
  useEffect(() => {
    setItems([]);
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load, pathname]);

  useEffect(() => {
    if (!open) return;
    load();
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  const count = items.length;
  // visitors without account have no notifications
  if (!user || pathname === "/login" || pathname === "/inscription") return null;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notif.title")}
        aria-expanded={open}
        title={t("notif.title")}
        className="relative flex items-center justify-center rounded-full bg-[#f2f6ec] p-2 leading-none text-[#6b7a5e] transition hover:bg-[#e4ecd8]"
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-[#e4e9dd] bg-white shadow-lg">
          <div className="border-b border-[#e4e9dd] px-4 py-3">
            <p className="text-sm font-extrabold text-[#2f3b26]">{t("notif.title")}</p>
            <p className="text-xs text-neutral-500">{t(audience === "BACKOFFICE" ? "notif.scope.backoffice" : "notif.scope.societe")}</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {audience === "SOCIETE" && !companyId ? (
              <p className="px-4 py-6 text-sm text-neutral-500">{t("notif.noSociete")}</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-neutral-500">{t("notif.empty")}</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {items.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex flex-col gap-0.5 px-4 py-3 text-sm transition hover:bg-[#f4f7ef]"
                    >
                      <span className="font-bold text-neutral-900">
                        {t(`notif.kind.${n.kind}`, { section: n.section ? t(`correction.section.${n.section}`) : "", company: n.company ?? "" })}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        {n.company && audience === "BACKOFFICE" && <span className="font-semibold text-neutral-700">{n.company}</span>}
                        {n.ref && <span>{n.ref}</span>}
                        <span>{timeAgo(n.at, lang)}</span>
                        {n.blocking && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                            {t("notif.blocking")}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
