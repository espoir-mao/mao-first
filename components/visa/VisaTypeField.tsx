"use client";

import type { VisaType } from "@/lib/visa-constants";
import { VISA_TYPES } from "@/lib/visa-constants";
import OptionRow from "../societe/OptionRow";
import { useLanguage } from "../LanguageProvider";

const ICONS: Record<VisaType, string> = {
  investor: "I",
  employee: "E",
  golden: "G",
  family: "F",
  domestic: "D",
  remote: "R",
};

interface VisaTypeFieldProps {
  value: VisaType | undefined;
  onChange: (value: VisaType) => void;
  error?: string;
}

export default function VisaTypeField({
  value,
  onChange,
  error,
}: VisaTypeFieldProps) {
  const { t, tMessage } = useLanguage();

  return (
    <div className="flex flex-col">
      {VISA_TYPES.map((type) => (
        <OptionRow
          key={type}
          label={t(`visa.type.${type}.label`)}
          description={t(`visa.type.${type}.desc`)}
          selected={value === type}
          onClick={() => onChange(type)}
          icon={ICONS[type]}
        />
      ))}
      {error && <p className="text-sm text-red-500">{tMessage(error)}</p>}
    </div>
  );
}
