"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { canAccess, isRestrictedPath } from "@/lib/profiles";
import { useLanguage } from "./LanguageProvider";
import { useProfile } from "./ProfileProvider";

/**
 * Wraps a whole page (header, sidebar, content). In the MAO-only areas
 * (Backoffice, Support) a société profile gets a plain "page not found": it must
 * not even learn that these pages exist, so nothing of the page — not even its
 * title in the header — is shown. Client-side only: the page data is not
 * protected by it (see README).
 */
export default function ShellGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { ready, active } = useProfile();

  if (!isRestrictedPath(pathname)) return <>{children}</>;
  if (!ready) return null; // do not flash protected content
  if (canAccess(active, pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 px-5 text-center">
      <h1 className="text-5xl font-extrabold text-neutral-900">404</h1>
      <p className="text-sm text-neutral-600">{t("notfound.body")}</p>
      <Link href="/" className="mt-2 text-sm font-bold text-[#4f7a37] hover:underline">
        {t("notfound.home")}
      </Link>
    </div>
  );
}
