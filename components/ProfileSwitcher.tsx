"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { landingFor, type Profile } from "@/lib/profiles";
import { useLanguage } from "./LanguageProvider";
import { useProfile } from "./ProfileProvider";

/**
 * Header chip showing the profile in use. Accounts that have both profiles
 * (demo: the owner account) can switch between "Société" and "Backoffice MAO".
 */
export default function ProfileSwitcher() {
  const { t } = useLanguage();
  const router = useRouter();
  const { ready, user, allowed, active, setActive } = useProfile();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  if (!ready || !user) return null;

  const tone =
    active === "BACKOFFICE" ? "bg-[#2f3b26] text-white" : "bg-[#f2f6ec] text-[#4a5f34]";
  const label = t(`profile.type.${active}`);

  if (allowed.length < 2) {
    return (
      <span className={`hidden rounded-full px-3 py-1.5 text-[11px] font-bold sm:block ${tone}`}>{label}</span>
    );
  }

  function choose(p: Profile) {
    setOpen(false);
    if (p === active) return;
    setActive(p);
    router.push(landingFor(p));
    router.refresh();
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("profile.switch.title")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition hover:brightness-95 ${tone}`}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-[#e4e9dd] bg-white p-1.5 shadow-lg">
          <p className="px-3 py-2 text-xs text-[#6b7a5e]">{t("profile.switch.title")}</p>
          {allowed.map((p) => (
            <button
              key={p}
              type="button"
              role="menuitemradio"
              aria-checked={p === active}
              onClick={() => choose(p)}
              className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition hover:bg-[#f2f6ec] ${p === active ? "bg-[#eef4e4]" : ""}`}
            >
              <span className="text-sm font-bold text-[#2f3b26]">{t(`profile.type.${p}`)}</span>
              <span className="text-xs text-neutral-500">{t(`profile.type.${p}.desc`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
