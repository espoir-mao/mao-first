"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { useActiveSociete } from "@/lib/active-societe";
import { canAccess } from "@/lib/profiles";
import { useProfile } from "./ProfileProvider";
import { ChevronRightIcon, MailIcon, SupportIcon } from "./Icons";

const COLLAPSE_STORAGE_KEY = "sidebar:collapsed";
const ADMINISTRATION_SECTION_STORAGE_KEY = "sidebar:administrationSectionOpen";
const BACKOFFICE_SECTION_STORAGE_KEY = "sidebar:backofficeSectionOpen";

const ADMINISTRATION_SUB_ROUTES = [
  "/administration/demandes",
  "/administration/visas",
  "/administration/utilisateurs",
] as const;
const BACKOFFICE_SUB_ROUTES = [
  "/backoffice/societes",
  "/backoffice/demandes",
  "/backoffice/visas",
  "/backoffice/licences",
  "/backoffice/profils",
] as const;

/** true / false once the person has toggled the section, null if never. */
function readStoredFlag(key: string): boolean | null {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

function writeStoredFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore (private browsing / blocked storage)
  }
}

/**
 * Persistent left-hand navigation. Top section: the three modules of the
 * app — Sociétés, Visas, Administration, Backoffice MAO — Light surface that extends the
 * app's white/light-green page theme, sitting below the top `Header` bar.
 * Collapsible to a narrow icon-only rail on larger screens.
 *
 * Once an active société is selected, the Sociétés entry additionally
 * exposes two retractable sub-pages — "À propos" (request tracking/status/
 * history) and "Licence" (trade license + renewal) — see app/a-propos and
 * app/licence. Administration is the société manager's own space: "Gestion de
 * demandes" (answers to MAO + support tickets), "Gestion de visa" (new request, in
 * progress, history — app/administration/visas) and "Utilisateurs". Backoffice MAO, last, is the MAO team's
 * cross-société area (no isolation by société): "Gestion des sociétés" (app/backoffice/societes), "Suivi
 * des visas" (app/backoffice/visas) and "Traitement des licences"
 * (app/backoffice/licences). Clicking an entry's name/icon (not just
 * its chevron) toggles that section open/closed, on top of navigating.
 *
 * Each page (/, /visas, /a-propos, /backoffice/…) renders its own
 * AppShell rather than sharing a persistent layout, so Sidebar fully
 * remounts on every navigation — a plain useState toggle would reset the
 * instant the link it was clicked on finishes navigating. The open/closed
 * flag for each section is therefore persisted to localStorage (same
 * approach as the sidebar's own collapse flag below) so it survives that
 * remount, in addition to auto-opening whenever the current page is one of
 * that section's sub-pages.
 *
 * Bottom section (pinned down with `mt-auto`): "Contacts" (a message form to
 * the admin, app/contact) and "Support" (the contact-message inbox,
 * app/support) — separate from the modules above, so they get their own
 * small divider.
 */
export default function Sidebar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const isBackoffice = Boolean(pathname?.startsWith("/backoffice"));
  const isAdministration = Boolean(pathname?.startsWith("/administration"));
  const [collapsed, setCollapsed] = useState(false);
  const [backofficeSectionOpen, setBackofficeSectionOpen] = useState(false);
  const [administrationSectionOpen, setAdministrationSectionOpen] = useState(false);
  const { activeSociete, mounted } = useActiveSociete();
  const { active: activeProfile } = useProfile();
  const isBackofficeProfile = canAccess(activeProfile, "/backoffice");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      // ignore (private browsing / blocked storage)
    }
  }, []);

  // Restore each section's last open/closed state from localStorage on
  // mount, then auto-open it whenever navigation lands directly on one of
  // its sub-pages (e.g. a bookmarked/shared link) regardless of what was
  // stored.
  useEffect(() => {
    // An explicit choice (open or closed) always wins; a section only opens by
    // itself the first time, when the person lands on one of its pages.
    const bo = readStoredFlag(BACKOFFICE_SECTION_STORAGE_KEY);
    const ad = readStoredFlag(ADMINISTRATION_SECTION_STORAGE_KEY);
    setBackofficeSectionOpen(bo ?? isBackoffice);
    setAdministrationSectionOpen(ad ?? isAdministration);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      writeStoredFlag(COLLAPSE_STORAGE_KEY, next);
      return next;
    });
  }

  function toggleAdministrationSection() {
    const next = !administrationSectionOpen;
    setAdministrationSectionOpen(next);
    writeStoredFlag(ADMINISTRATION_SECTION_STORAGE_KEY, next);
  }

  function toggleBackofficeSection() {
    const next = !backofficeSectionOpen;
    setBackofficeSectionOpen(next);
    writeStoredFlag(BACKOFFICE_SECTION_STORAGE_KEY, next);
  }

  const showActiveSociete = mounted && Boolean(activeSociete);

  const societeIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 21V7l8-4 8 4v14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 21v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const aboutIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5M12 8v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );

  const licenceIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h9l3 3v15H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 11h6M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );

  const bottomItems = (
    [
      { href: "/support", labelKey: "nav.support", icon: <SupportIcon /> },
    ] as const
  ).filter((item) => canAccess(activeProfile, item.href));

  const backofficeIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 13.5a7.97 7.97 0 0 0 0-3l1.8-1.4-2-3.46-2.1.6a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.24a8 8 0 0 0-2.6 1.5l-2.1-.6-2 3.46L4.6 10.5a7.97 7.97 0 0 0 0 3l-1.8 1.4 2 3.46 2.1-.6a8 8 0 0 0 2.6 1.5l.5 2.24h4l.5-2.24a8 8 0 0 0 2.6-1.5l2.1.6 2-3.46-1.8-1.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );

  const administrationIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.5 5.2a3 3 0 0 1 0 5.6M18 14.3c1.8.8 3 2.6 3 4.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );

  const administrationSubLinks = [
    { href: "/administration/demandes", label: t("administration.nav.requests") },
    { href: "/administration/visas", label: t("administration.nav.visas") },
    { href: "/administration/utilisateurs", label: t("administration.nav.users") },
  ] as const;

  const backofficeSubLinks = [
    { href: "/backoffice/societes", label: t("admin.nav.societes") },
    { href: "/backoffice/demandes", label: t("admin.nav.requests") },
    { href: "/backoffice/visas", label: t("admin.nav.visas") },
    { href: "/backoffice/licences", label: t("admin.nav.licenses") },
    { href: "/backoffice/profils", label: t("admin.nav.profiles") },
  ] as const;

  return (
    <nav
      aria-label="Modules"
      className={`sticky top-14 flex h-[calc(100vh-56px)] w-full shrink-0 flex-row gap-1 overflow-x-auto border-[#e4e9dd] bg-white px-2 py-2 shadow-[1px_0_0_rgba(0,0,0,0.03)] sm:flex-col sm:gap-1.5 sm:overflow-visible sm:border-r sm:px-3 sm:py-6 ${
        collapsed ? "sm:w-16" : "sm:w-56 lg:w-64"
      }`}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? t("nav.expand") : t("nav.collapse")}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="mb-2 hidden items-center justify-center self-end rounded-lg p-1.5 text-[#6b7a5e] transition hover:bg-[#f2f6ec] hover:text-[#2f3b26] sm:flex"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
        >
          <path
            d="M15 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Active société (top of the sidebar) with a shortcut to switch. */}
      {showActiveSociete && (
        <div
          className={`mb-1 flex items-center gap-2 rounded-xl bg-[#f4f7ef] px-3 py-2 ${
            collapsed ? "sm:justify-center sm:px-0" : ""
          }`}
        >
          <span className="text-[#4f7a37]">{societeIcon}</span>
          <span
            className={`min-w-0 flex-1 truncate text-sm font-bold text-[#2f3b26] ${
              collapsed ? "sm:hidden" : ""
            }`}
            title={activeSociete!.name}
          >
            {activeSociete!.name}
          </span>
          <Link
            href="/choisir-societe"
            title={t("home.dashboard.actions.switch")}
            aria-label={t("home.dashboard.actions.switch")}
            className={`flex items-center justify-center rounded-lg p-1.5 text-[#6b7a5e] transition hover:bg-white hover:text-[#2f3b26] ${
              collapsed ? "sm:hidden" : ""
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 7h12l-3-3M17 17H5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      )}

      {/* Flat pages: Dashboard, then (with an active société) À propos and Licence. */}
      {(
        [
          { href: "/", label: t("nav.dashboard"), icon: societeIcon, active: pathname === "/", show: true },
          { href: "/a-propos", label: t("home.tabs.about"), icon: aboutIcon, active: pathname === "/a-propos", show: showActiveSociete },
          { href: "/licence", label: t("home.tabs.license"), icon: licenceIcon, active: pathname === "/licence", show: showActiveSociete },
        ] as const
      )
        .filter((item) => item.show)
        .map((item) => (
          <div key={item.href} className="flex flex-col gap-0.5">
            <div
              className={`flex items-center rounded-xl border-l-4 sm:rounded-r-xl sm:rounded-l-none ${
                item.active ? "border-[#7a9a5a] bg-[#eef4e4]" : "border-transparent"
              }`}
            >
              <Link
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm transition ${
                  collapsed ? "sm:justify-center sm:px-0" : ""
                } ${
                  item.active
                    ? "font-bold text-[#2f3b26]"
                    : "text-[#5b6356] hover:text-[#2f3b26]"
                }`}
              >
                <span className={item.active ? "text-[#4f7a37]" : "text-[#8a9480]"}>
                  {item.icon}
                </span>
                <span className={`truncate whitespace-nowrap ${collapsed ? "sm:hidden" : ""}`}>
                  {item.label}
                </span>
              </Link>
            </div>
          </div>
        ))}

      {/* Administration entry (the société manager's own space: "Mes demandes" and "Utilisateurs"), scoped to the active société, right below Visas. */}
      <div className="flex flex-col gap-0.5">
        <div
          className={`flex items-center rounded-xl border-l-4 sm:rounded-r-xl sm:rounded-l-none ${
            isAdministration ? "border-[#7a9a5a] bg-[#eef4e4]" : "border-transparent"
          }`}
        >
          <Link
            href="/administration/demandes"
            onClick={() => {
              toggleAdministrationSection();
            }}
            aria-current={isAdministration ? "page" : undefined}
            title={collapsed ? t("nav.administration") : undefined}
            className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm transition ${
              collapsed ? "sm:justify-center sm:px-0" : ""
            } ${
              isAdministration
                ? "font-bold text-[#2f3b26]"
                : "text-[#5b6356] hover:text-[#2f3b26]"
            }`}
          >
            <span className={isAdministration ? "text-[#4f7a37]" : "text-[#8a9480]"}>
              {administrationIcon}
            </span>
            <span
              className={`truncate whitespace-nowrap ${
                collapsed ? "sm:hidden" : ""
              }`}
            >
              {t("nav.administration")}
            </span>
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={toggleAdministrationSection}
              aria-label={administrationSectionOpen ? t("nav.collapse") : t("nav.expand")}
              aria-expanded={administrationSectionOpen}
              className="mr-2 flex items-center justify-center rounded-lg p-1.5 text-[#8a9480] transition hover:bg-[#f2f6ec] hover:text-[#2f3b26]"
            >
              <ChevronRightIcon
                className={`h-4 w-4 transition-transform ${
                  administrationSectionOpen ? "rotate-90" : ""
                }`}
              />
            </button>
          )}
        </div>

        {!collapsed && administrationSectionOpen && (
          <div className="flex flex-col gap-0.5">
            {administrationSubLinks.map((sub) => {
              const active = pathname === sub.href || Boolean(pathname?.startsWith(`${sub.href}/`));
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  aria-current={active ? "page" : undefined}
                  className={`truncate rounded-xl py-2 pl-11 pr-3 text-sm transition ${
                    active
                      ? "bg-[#eef4e4] font-bold text-[#2f3b26]"
                      : "text-[#5b6356] hover:bg-[#f4f7ef] hover:text-[#2f3b26]"
                  }`}
                >
                  {sub.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {isBackofficeProfile && (
        <>
      {/* Backoffice MAO entry, expandable — cross-société (MAO team), no
          isolation by société; last of the top modules. */}
      <div className="flex flex-col gap-0.5">
        <div
          className={`flex items-center rounded-xl border-l-4 sm:rounded-r-xl sm:rounded-l-none ${
            isBackoffice ? "border-[#7a9a5a] bg-[#eef4e4]" : "border-transparent"
          }`}
        >
          <Link
            href="/backoffice/societes"
            onClick={() => {
              toggleBackofficeSection();
            }}
            aria-current={isBackoffice ? "page" : undefined}
            title={collapsed ? t("nav.backoffice") : undefined}
            className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm transition ${
              collapsed ? "sm:justify-center sm:px-0" : ""
            } ${
              isBackoffice
                ? "font-bold text-[#2f3b26]"
                : "text-[#5b6356] hover:text-[#2f3b26]"
            }`}
          >
            <span className={isBackoffice ? "text-[#4f7a37]" : "text-[#8a9480]"}>
              {backofficeIcon}
            </span>
            <span
              className={`truncate whitespace-nowrap ${
                collapsed ? "sm:hidden" : ""
              }`}
            >
              {t("nav.backoffice")}
            </span>
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={toggleBackofficeSection}
              aria-label={backofficeSectionOpen ? t("nav.collapse") : t("nav.expand")}
              aria-expanded={backofficeSectionOpen}
              className="mr-2 flex items-center justify-center rounded-lg p-1.5 text-[#8a9480] transition hover:bg-[#f2f6ec] hover:text-[#2f3b26]"
            >
              <ChevronRightIcon
                className={`h-4 w-4 transition-transform ${
                  backofficeSectionOpen ? "rotate-90" : ""
                }`}
              />
            </button>
          )}
        </div>

        {!collapsed && backofficeSectionOpen && (
          <div className="flex flex-col gap-0.5">
            {backofficeSubLinks.map((sub) => {
              const active = pathname === sub.href || Boolean(pathname?.startsWith(`${sub.href}/`));
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  aria-current={active ? "page" : undefined}
                  className={`truncate rounded-xl py-2 pl-11 pr-3 text-sm transition ${
                    active
                      ? "bg-[#eef4e4] font-bold text-[#2f3b26]"
                      : "text-[#5b6356] hover:bg-[#f4f7ef] hover:text-[#2f3b26]"
                  }`}
                >
                  {sub.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}

      {/* Contacts / Support — pinned to the bottom of the panel, separate
          from the société/visa/backoffice modules above. */}
      <div className="mt-auto flex flex-col gap-1 border-t border-[#e4e9dd] pt-2">
        {bottomItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? t(item.labelKey) : undefined}
              className={`flex items-center gap-3 rounded-xl border-l-4 px-3 py-2.5 text-sm transition sm:rounded-r-xl sm:rounded-l-none ${
                collapsed ? "sm:justify-center sm:px-0" : ""
              } ${
                active
                  ? "border-[#7a9a5a] bg-[#eef4e4] font-bold text-[#2f3b26]"
                  : "border-transparent text-[#5b6356] hover:bg-[#f4f7ef] hover:text-[#2f3b26]"
              }`}
            >
              <span className={active ? "text-[#4f7a37]" : "text-[#8a9480]"}>
                {item.icon}
              </span>
              <span
                className={`truncate whitespace-nowrap ${
                  collapsed ? "sm:hidden" : ""
                }`}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
