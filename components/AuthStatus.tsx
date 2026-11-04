"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabaseClient";
import { getUserAvatarUrl, getUserDisplayName, getUserInitials } from "@/lib/profile";
import { useLanguage } from "./LanguageProvider";

/**
 * Small, presentational session indicator for the header: shows a small
 * circular avatar button (photo or initials) opening a menu (my profile,
 * switch société, log out) when a Supabase session exists, otherwise a
 * "Log in" link to /login. Purely
 * informational — it does NOT gate access to any page; route protection is
 * out of scope for this app.
 */
export default function AuthStatus() {
  const { t } = useLanguage();
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      return;
    }

    let active = true;
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) setUser(session?.user ?? null);
      }
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Avoid a flash of the wrong state before the session check resolves.
  if (user === undefined) {
    return <span className="hidden h-8 w-8 sm:block" aria-hidden="true" />;
  }

  if (user) {
    const avatarUrl = getUserAvatarUrl(user);
    const initials = getUserInitials(user);
    const name = getUserDisplayName(user);

    const itemCls =
      "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[#2f3b26] transition hover:bg-[#f2f6ec]";
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t("header.auth.profile.aria", { name })}
          aria-haspopup="menu"
          aria-expanded={open}
          title={name}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7a9a5a] text-xs font-bold text-white transition hover:brightness-95"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-[#e4e9dd] bg-white p-1.5 shadow-lg"
          >
            <div className="truncate px-3 py-2 text-xs text-[#6b7a5e]">{user.email}</div>
            <Link href="/profil" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
              {t("header.menu.profile")}
            </Link>
            <Link href="/choisir-societe" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
              {t("header.menu.switchSociete")}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className={`${itemCls} border-t border-[#e4e9dd] disabled:opacity-60`}
            >
              {signingOut ? t("profile.signout.pending") : t("profile.signout")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-bold text-[#6b7a5e] transition hover:text-[#2f3b26] sm:px-3"
    >
      {t("header.auth.login")}
    </Link>
  );
}
