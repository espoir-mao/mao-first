"use client";

import IllustrationPanel from "./IllustrationPanel";
import { useLanguage } from "../LanguageProvider";

interface WizardShellProps {
  title: string;
  subtitle: string;
  onBack?: () => void;
  onCancel?: () => void;
  stepIndex: number;
  stepCount: number;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** Optional overrides for the decorative illustration panel's copy, so
   * other wizards (e.g. the visa module) reusing this shell can show
   * on-brand text instead of the société-wizard defaults. */
  illustrationChip1Key?: string;
  illustrationTitleKey?: string;
  illustrationBodyKey?: string;
}

export default function WizardShell({
  title,
  subtitle,
  onBack,
  onCancel,
  stepIndex,
  stepCount,
  children,
  footer,
  illustrationChip1Key,
  illustrationTitleKey,
  illustrationBodyKey,
}: WizardShellProps) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 gap-6 rounded-2xl bg-white p-4 sm:p-6 lg:grid-cols-[2fr_3fr] lg:gap-10 lg:p-10">
      <IllustrationPanel
        chip1Key={illustrationChip1Key}
        titleKey={illustrationTitleKey}
        bodyKey={illustrationBodyKey}
      />

      <div className="flex w-full max-w-2xl flex-col gap-5">
        <div className="flex items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm font-semibold text-neutral-500 transition hover:text-neutral-800"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10 3L5 8L10 13"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("wizard.back")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              {t("wizard.step", { current: stepIndex + 1, total: stepCount })}
            </span>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs font-semibold text-neutral-400 underline-offset-2 transition hover:text-red-500 hover:underline"
              >
                {t("wizard.cancel")}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-extrabold leading-tight text-neutral-900">
            {title}
          </h2>
          <p className="text-sm text-neutral-500">{subtitle}</p>
        </div>

        <div className="flex flex-col gap-4">{children}</div>

        <div className="mt-1">{footer}</div>
      </div>
    </div>
  );
}
