"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@/lib/auth-schema";
import { signInWithPassword } from "@/lib/auth";
import AuthLayout from "@/components/auth/AuthLayout";
import PasswordField from "@/components/auth/PasswordField";
import { useLanguage } from "@/components/LanguageProvider";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
  });

  async function onSubmit(values: LoginFormValues) {
    setSubmitError(null);
    setIsSubmitting(true);
    const result = await signInWithPassword(values.email, values.password);
    setIsSubmitting(false);

    if (!result.success) {
      if (result.error === "config") {
        setSubmitError(t("auth.error.config"));
      } else if (
        result.error &&
        /invalid login credentials/i.test(result.error)
      ) {
        setSubmitError(t("auth.login.error.invalid"));
      } else {
        setSubmitError(result.error ?? t("auth.error.generic"));
      }
      return;
    }

    router.push("/choisir-societe");
    router.refresh();
  }

  return (
    <AuthLayout titleKey="header.title.login">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            {t("auth.login.title")}
          </h2>
          <p className="text-sm text-neutral-500">{t("auth.login.subtitle")}</p>
        </div>

        {submitError && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
            {submitError}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-neutral-600">
            {t("auth.field.email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
          />
          {errors.email?.message && (
            <p className="text-sm text-red-500">{t(errors.email.message)}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <PasswordField
            id="password"
            label={t("auth.field.password")}
            registration={register("password")}
            autoComplete="current-password"
            error={errors.password?.message ? t(errors.password.message) : undefined}
          />
          <div className="flex justify-end">
            <Link
              href="#"
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-800"
            >
              {t("auth.login.forgot")}
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-[#7a9a5a] px-6 py-3.5 text-center text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
        >
          {isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>

        <p className="text-center text-sm text-neutral-500">
          {t("auth.login.noAccount")}{" "}
          <Link href="/inscription" className="font-bold text-neutral-900 hover:underline">
            {t("auth.login.createAccount")}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
