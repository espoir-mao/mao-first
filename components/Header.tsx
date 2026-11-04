"use client";

import Link from "next/link";
import Logo from "./Logo";
import AuthStatus from "./AuthStatus";
import NotificationBell from "./NotificationBell";
import ProfileSwitcher from "./ProfileSwitcher";
import Flag from "./Flag";
import { useLanguage } from "./LanguageProvider";
import { useTheme } from "./ThemeProvider";
import { MailIcon, MoonIcon, SunIcon } from "./Icons";

interface HeaderProps {
  /** Translation key for the page/section title shown next to the logo. */
  titleKey: string;
}

export default function Header({ titleKey }: HeaderProps) {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="sticky top-0 z-20 w-full">
      <header className="flex h-14 w-full items-center justify-between gap-3 border-b border-[#e4e9dd] bg-white px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex min-w-0 flex-shrink-0 items-center" aria-label={t("app.wordmark")}>
            <Logo />
          </Link>

          <span
            className="hidden h-5 w-px flex-shrink-0 bg-[#e4e9dd] sm:block"
            aria-hidden="true"
          />

          <h1 className="truncate text-left text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#2f3b26] sm:text-xs sm:tracking-[0.16em]">
            {t(titleKey)}
          </h1>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/contact"
            title={t("nav.contactUs")}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold text-[#6b7a5e] transition hover:bg-[#f2f6ec] hover:text-[#2f3b26]"
          >
            <MailIcon />
            <span className="hidden sm:inline">{t("nav.contactUs")}</span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={t(theme === "dark" ? "theme.dark" : "theme.light")}
            title={t(theme === "dark" ? "theme.dark" : "theme.light")}
            className="flex items-center justify-center rounded-full bg-[#f2f6ec] p-2 leading-none text-[#6b7a5e] transition hover:bg-[#e4ecd8]"
          >
            {theme === "dark" ? <MoonIcon /> : <SunIcon />}
          </button>
          <ProfileSwitcher />
          <NotificationBell />
          {(() => {
            const LANGUAGES = {
              fr: { name: "Français" },
              en: { name: "English" },
            } as const;
            const current = LANGUAGES[lang];
            const next = lang === "fr" ? "en" : "fr";
            return (
              <button
                type="button"
                onClick={() => setLang(next)}
                aria-label={current.name}
                title={current.name}
                className="flex items-center justify-center rounded-full bg-[#f2f6ec] px-2.5 py-1.5 leading-none text-[#6b7a5e] transition hover:bg-[#e4ecd8]"
              >
                <Flag lang={lang} className="rounded-[2px]" />
              </button>
            );
          })()}
          <AuthStatus />
        </div>
      </header>
    </div>
  );
}
