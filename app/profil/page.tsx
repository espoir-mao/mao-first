"use client";

import AppShell from "@/components/AppShell";
import ProfileClient from "@/components/ProfileClient";
import { useLanguage } from "@/components/LanguageProvider";

export default function ProfilPage() {
  const { t } = useLanguage();

  return (
    <AppShell titleKey="header.title.profile">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8 sm:max-w-2xl sm:py-12">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
            {t("profile.heading")}
          </h1>
          <p className="text-sm text-neutral-600">{t("profile.subtitle")}</p>
        </div>

        <ProfileClient />
      </div>
    </AppShell>
  );
}
