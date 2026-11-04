"use client";

import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { EyeIcon, EyeOffIcon } from "../Icons";
import { useLanguage } from "../LanguageProvider";

interface PasswordFieldProps {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  autoComplete?: string;
}

export default function PasswordField({
  id,
  label,
  registration,
  error,
  autoComplete,
}: PasswordFieldProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-600">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          {...registration}
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 pr-11 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={t(
            visible
              ? "auth.field.password.toggle.hide"
              : "auth.field.password.toggle.show"
          )}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition hover:text-neutral-700"
        >
          {visible ? (
            <EyeOffIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
