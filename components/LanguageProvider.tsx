"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LANG,
  translate,
  translateEmirate,
  translateMessage,
  translateOption,
  type Lang,
} from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tEmirate: (emirate: string) => string;
  tMessage: (message: string | undefined) => string | undefined;
  tOption: (prefix: string, id: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export default function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(lang, key, vars),
    [lang]
  );
  const tEmirate = useCallback(
    (emirate: string) => translateEmirate(lang, emirate),
    [lang]
  );
  const tMessage = useCallback(
    (message: string | undefined) => translateMessage(lang, message),
    [lang]
  );
  const tOption = useCallback(
    (prefix: string, id: string) => translateOption(lang, prefix, id),
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, t, tEmirate, tMessage, tOption }),
    [lang, t, tEmirate, tMessage, tOption]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
