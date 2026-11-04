"use client";

import { useLanguage } from "./LanguageProvider";

export default function ConfigNotice() {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-neutral-800 sm:p-8">
      <h2 className="text-lg font-bold">{t("list.config.title")}</h2>
      <p className="mt-2 text-sm text-neutral-600">{t("list.config.body")}</p>
    </div>
  );
}
