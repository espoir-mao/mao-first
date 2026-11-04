"use client";

import Header from "../Header";
import Logo from "../Logo";
import { useLanguage } from "../LanguageProvider";

interface AuthLayoutProps {
  titleKey: string;
  children: React.ReactNode;
}

/**
 * Shared full-height, two-panel layout for /login and /inscription: a solid
 * indigo panel on the left with an original abstract illustration and a
 * couple of floating "info chip" cards, and a white form panel on the
 * right. Stacks vertically on mobile.
 */
export default function AuthLayout({ titleKey, children }: AuthLayoutProps) {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header titleKey={titleKey} />

      <main className="flex flex-1 flex-col lg:flex-row">
        {/* Left panel */}
        <div className="relative flex min-h-[280px] flex-shrink-0 flex-col justify-between overflow-hidden bg-[#2d2a4a] p-6 sm:p-8 lg:w-[45%] lg:min-h-0 lg:rounded-r-[2.5rem] lg:p-10">
          <div className="relative z-10 hidden sm:block">
            <Logo variant="light" />
          </div>

          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 400 500"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <circle cx="330" cy="80" r="140" fill="#3d3968" opacity="0.6" />
            <path
              d="M20 320C60 240 160 210 230 250C300 290 360 260 370 340C380 420 300 470 210 460C120 450 -20 400 20 320Z"
              fill="#413c6e"
              opacity="0.85"
            />
            <path
              d="M120 150L260 120L300 230L180 280Z"
              fill="#4a4578"
              opacity="0.7"
            />
            <circle cx="150" cy="210" r="46" fill="#f4c96a" opacity="0.9" />
            <rect
              x="120"
              y="230"
              width="60"
              height="100"
              rx="16"
              fill="#232043"
              opacity="0.9"
            />
            <circle cx="150" cy="260" r="14" fill="#7a9a5a" opacity="0.9" />
          </svg>

          <div className="relative z-10 flex justify-end">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-lg shadow-black/20">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7a9a5a] text-[11px] font-bold text-white">
                ✓
              </span>
              <span className="text-xs font-bold text-[#242038]">
                {t("auth.illustration.chip1")}
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-4 flex items-end justify-between">
            <div className="flex items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 shadow-lg shadow-black/20">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#f4f0e6] text-[13px] font-bold text-[#a8843c]">
                ▤
              </span>
              <span className="flex flex-col gap-1">
                <span className="block h-1.5 w-14 rounded-full bg-neutral-200" />
                <span className="block h-1.5 w-9 rounded-full bg-neutral-200" />
              </span>
            </div>

            <span
              className="hidden h-9 w-9 flex-shrink-0 rounded-full bg-[#9AE22F] sm:block"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10 lg:py-14">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
