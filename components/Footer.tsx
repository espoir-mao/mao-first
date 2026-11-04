"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

const PHONE_DISPLAY = "0978288310";
const PHONE_HREF = "tel:0978288310";
const EMAIL = "contact@mao.com";
const SOCIALS = [
  { label: "Linkedin", href: "https://www.linkedin.com/" },
  { label: "Instagram", href: "https://www.instagram.com/" },
];

const linkCls = "text-sm text-[#c4d0c4] transition hover:text-white";

/** Dark site footer shown at the bottom of every page. */
export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="w-full bg-[#0d1e27] px-6 py-10 text-white sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div className="flex flex-col gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mao-logo-full-dark.png" alt="MAO - My Accountant Online" width={311} height={105} className="-ml-3 h-20 w-auto self-start" />
            <p className="max-w-xs text-base leading-snug text-[#d8e2d8]">{t("footer.tagline")}</p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-base font-bold">{t("footer.contact")}</h2>
            <p className={linkCls}>{t("footer.office")}</p>
            <p className={linkCls}>
              {t("footer.tel")} <a href={PHONE_HREF} className="hover:underline">{PHONE_DISPLAY}</a>
            </p>
            <p className={linkCls}>
              {t("footer.mail")} <a href={`mailto:${EMAIL}`} className="hover:underline">{EMAIL}</a>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-base font-bold">{t("footer.links")}</h2>
            {SOCIALS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
                {s.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/15 pt-5 text-xs text-[#c4d0c4] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} MAO. {t("footer.rights")}</span>
          <nav className="flex items-center" aria-label="Legal">
            <Link href="/confidentialite" className="pr-3 transition hover:text-white">{t("footer.privacy")}</Link>
            <Link href="/mentions-legales" className="border-l border-white/30 pl-3 transition hover:text-white">{t("footer.legal")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
