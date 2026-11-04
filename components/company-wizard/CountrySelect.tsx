"use client";

import { useMemo } from "react";
import { countryOptions } from "@/lib/countries";
import { useLanguage } from "../LanguageProvider";
import { inputClass } from "./ui";

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
}

/** Every country of the world, named in the interface language (English name stored). */
export default function CountrySelect({ value, onChange }: CountrySelectProps) {
  const { lang, t } = useLanguage();
  const options = useMemo(() => countryOptions(lang), [lang]);
  const known = options.some((o) => o.value === value);
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t("company.country.choose")}</option>
      {value && !known && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
