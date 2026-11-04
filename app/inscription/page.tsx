"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupFormValues } from "@/lib/auth-schema";
import { signUpWithPassword } from "@/lib/auth";
import AuthLayout from "@/components/auth/AuthLayout";
import PasswordField from "@/components/auth/PasswordField";
import { useLanguage } from "@/components/LanguageProvider";

export default function InscriptionPage() {
  const { t } = useLanguage();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onSubmit",
  });

  async function onSubmit(values: SignupFormValues) {
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    const result = await signUpWithPassword(
      values.firstName,
      values.lastName,
      values.email,
      values.password
    );
    setIsSubmitting(false);

    if (!result.success) {
      if (result.error === "config") {
        setSubmitError(t("auth.error.config"));
      } else if (
        result.error &&
        /already registered|already exists|user already registered/i.test(
          result.error
        )
      ) {
        setSubmitError(t("auth.signup.error.exists"));
      } else {
        setSubmitError(result.error ?? t("auth.error.generic"));
      }
      return;
    }

    setSuccessMessage(t("auth.signup.success"));
  }

  return (
    <AuthLayout titleKey="header.title.signup">
      {successMessage ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            {t("auth.signup.title")}
          </h2>
          <div className="rounded-xl border border-[#7a9a5a]/30 bg-[#eef5e2] px-4 py-3 text-sm text-[#3f5029]">
            {successMessage}
          </div>
          <Link
            href="/login"
            className="w-full rounded-full bg-[#7a9a5a] px-6 py-3.5 text-center text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95"
          >
            {t("auth.signup.signIn")}
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
              {t("auth.signup.title")}
            </h2>
            <p className="text-sm text-neutral-500">
              {t("auth.signup.subtitle")}
            </p>
          </div>

          {submitError && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="firstName"
                className="text-sm font-medium text-neutral-600"
              >
                {t("auth.field.firstname")}
              </label>
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                {...register("firstName")}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
              />
              {errors.firstName?.message && (
                <p className="text-sm text-red-500">
                  {t(errors.firstName.message)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="lastName"
                className="text-sm font-medium text-neutral-600"
              >
                {t("auth.field.lastname")}
              </label>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                {...register("lastName")}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
              />
              {errors.lastName?.message && (
                <p className="text-sm text-red-500">
                  {t(errors.lastName.message)}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-neutral-600"
            >
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

          <PasswordField
            id="password"
            label={t("auth.field.password")}
            registration={register("password")}
            autoComplete="new-password"
            error={
              errors.password?.message ? t(errors.password.message) : undefined
            }
          />

          <PasswordField
            id="confirmPassword"
            label={t("auth.field.confirmPassword")}
            registration={register("confirmPassword")}
            autoComplete="new-password"
            error={
              errors.confirmPassword?.message
                ? t(errors.confirmPassword.message)
                : undefined
            }
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#7a9a5a] px-6 py-3.5 text-center text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60"
          >
            {isSubmitting
              ? t("auth.signup.submitting")
              : t("auth.signup.submit")}
          </button>

          <p className="text-center text-sm text-neutral-500">
            {t("auth.signup.hasAccount")}{" "}
            <Link
              href="/login"
              className="font-bold text-neutral-900 hover:underline"
            >
              {t("auth.signup.signIn")}
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
