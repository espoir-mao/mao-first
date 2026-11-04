"use client";

import { useLanguage } from "./LanguageProvider";

export default function ListPageHeading() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        {t("list.heading.pre")}{" "}
        <span className="text-[#5f7a45]">{t("list.heading.accent")}</span>{" "}
        {t("list.heading.post")}
      </h1>
      <p className="text-sm text-neutral-600">{t("list.subtitle")}</p>
    </div>
  );
}
