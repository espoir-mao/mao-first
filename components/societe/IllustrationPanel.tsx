"use client";

import { useLanguage } from "../LanguageProvider";

/**
 * Purely decorative left-column illustration: an original abstract
 * composition of soft rounded green ribbon/blob shapes sitting on a pale
 * mint rounded rectangle, plus a couple of floating "info chip" cards,
 * echoing a playful onboarding data-chip motif. No real data, no copied
 * photography or third-party artwork.
 */
interface IllustrationPanelProps {
  /** i18n keys, overridable so the panel's copy can fit its context
   * (wizard step vs. main list page) while reusing the same visual. */
  chip1Key?: string;
  titleKey?: string;
  bodyKey?: string;
}

export default function IllustrationPanel({
  chip1Key = "wizard.illustration.chip1",
  titleKey = "wizard.illustration.title",
  bodyKey = "wizard.illustration.body",
}: IllustrationPanelProps) {
  const { t } = useLanguage();

  return (
    <div className="relative hidden h-full min-h-[420px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-spring-200 to-spring-300 p-6 lg:flex">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 500"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <circle cx="80" cy="90" r="120" fill="#c9e6ab" opacity="0.55" />
        <circle cx="320" cy="420" r="150" fill="#a8c284" opacity="0.35" />
        <path
          d="M40 260C40 180 120 150 200 180C280 210 340 180 360 260C380 340 320 420 220 420C120 420 40 340 40 260Z"
          fill="#f2f9ea"
          opacity="0.9"
        />
        <path
          d="M100 200C130 160 200 150 230 190C260 230 320 220 330 270C340 320 280 360 220 350C160 340 70 250 100 200Z"
          fill="#e6f3d4"
          opacity="0.6"
        />
        <circle cx="230" cy="140" r="34" fill="#ffffff" opacity="0.85" />
        <circle cx="120" cy="360" r="18" fill="#7a9a5a" opacity="0.35" />
      </svg>

      <div className="relative z-10 flex justify-end">
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-md shadow-black/5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7a9a5a] text-[11px] font-bold text-white">
            ✓
          </span>
          <span className="text-xs font-bold text-[#2c3524]">
            {t(chip1Key)}
          </span>
        </div>
      </div>

      <div className="relative z-10 flex justify-start">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 shadow-md shadow-black/5">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-spring-100 text-[13px] font-bold text-[#5f7a45]">
            ▤
          </span>
          <span className="flex flex-col gap-1">
            <span className="block h-1.5 w-14 rounded-full bg-neutral-200" />
            <span className="block h-1.5 w-9 rounded-full bg-neutral-200" />
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-4 rounded-2xl bg-white/85 p-4 shadow-md shadow-black/5">
        <p className="text-sm font-extrabold text-[#2c3524]">
          {t(titleKey)}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#4a5540]">
          {t(bodyKey)}
        </p>
      </div>
    </div>
  );
}
