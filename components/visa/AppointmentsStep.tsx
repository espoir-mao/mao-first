"use client";

import { useState, useTransition } from "react";
import type { UseFormRegister } from "react-hook-form";
import type { VisaFormValues } from "@/lib/visa-schema";
import { APPOINTMENT_SLOTS, TYPING_CENTERS } from "@/lib/visa-constants";
import { sendVisaAppointmentPreference } from "@/app/actions/visa";
import { useLanguage } from "../LanguageProvider";

interface AppointmentsStepProps {
  register: UseFormRegister<VisaFormValues>;
  medical: VisaFormValues["medical_appointment"];
  biometric: VisaFormValues["biometric_appointment"];
  onStatusChange: (
    kind: "medical" | "biometric",
    status: "a_planifier" | "preference_envoyee",
    notifiedAt: string | null
  ) => void;
}

const inputClass =
  "w-full max-w-md rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-[#7a9a5a]";

function AppointmentSection({
  kind,
  titleKey,
  appointment,
  register,
  onStatusChange,
}: {
  kind: "medical" | "biometric";
  titleKey: string;
  appointment: VisaFormValues["medical_appointment"];
  register: UseFormRegister<VisaFormValues>;
  onStatusChange: AppointmentsStepProps["onStatusChange"];
}) {
  const { t, tOption } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const fieldPrefix =
    kind === "medical" ? "medical_appointment" : "biometric_appointment";

  function handleNotify() {
    startTransition(async () => {
      const result = await sendVisaAppointmentPreference(kind);
      if (result.success && result.data) {
        onStatusChange(kind, "preference_envoyee", result.data.notified_at);
      }
    });
  }

  const statusLabel = t(`visa.step.appointments.status.${appointment.status}`);
  const isSent = appointment.status === "preference_envoyee";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-neutral-900">{t(titleKey)}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            isSent
              ? "bg-[#7a9a5a]/20 text-[#4a5f34]"
              : "bg-neutral-200 text-neutral-500"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-600">
            {t("visa.step.appointments.field.date")}
          </label>
          <input
            type="date"
            {...register(`${fieldPrefix}.date` as const)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-600">
            {t("visa.step.appointments.field.slot")}
          </label>
          <select
            {...register(`${fieldPrefix}.slot` as const)}
            className={inputClass}
          >
            <option value="">{t("visa.step.appointments.field.slot")}</option>
            {APPOINTMENT_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {tOption("visa.slot", slot)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-sm font-medium text-neutral-600">
            {t("visa.step.appointments.field.center")}
          </label>
          <select
            {...register(`${fieldPrefix}.center` as const)}
            className={inputClass}
          >
            <option value="">{t("visa.step.appointments.field.center")}</option>
            {TYPING_CENTERS.map((center) => (
              <option key={center} value={center}>
                {tOption("visa.center", center)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleNotify}
          disabled={isPending}
          className="rounded-full border border-[#7a9a5a]/40 bg-[#7a9a5a]/10 px-4 py-2 text-xs font-bold text-[#4a5f34] transition hover:bg-[#7a9a5a]/20 disabled:opacity-60"
        >
          {isPending
            ? t("visa.step.appointments.notifying")
            : t("visa.step.appointments.notify")}
        </button>
        {appointment.notified_at && (
          <span className="text-xs text-neutral-500">
            {t("visa.step.appointments.notified.at", {
              date: new Date(appointment.notified_at).toLocaleString(),
            })}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AppointmentsStep({
  register,
  medical,
  biometric,
  onStatusChange,
}: AppointmentsStepProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t("visa.step.appointments.banner")}
      </div>

      <AppointmentSection
        kind="medical"
        titleKey="visa.step.appointments.medical.title"
        appointment={medical}
        register={register}
        onStatusChange={onStatusChange}
      />
      <AppointmentSection
        kind="biometric"
        titleKey="visa.step.appointments.biometric.title"
        appointment={biometric}
        register={register}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
