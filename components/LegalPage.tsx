"use client";

import Header from "./Header";
import { useLanguage } from "./LanguageProvider";

export interface LegalSection {
  title: string;
  body: string[];
}

/** Public text page (privacy, legal notice): header + readable column. */
export default function LegalPage({
  titleKey,
  content,
}: {
  titleKey: string;
  content: Record<"fr" | "en", { heading: string; sections: LegalSection[] }>;
}) {
  const { lang } = useLanguage();
  const c = content[lang];
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header titleKey={titleKey} />
      <main className="w-full flex-1 bg-neutral-100">
        <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-16">
          <h1 className="text-3xl font-extrabold text-neutral-900 sm:text-4xl">{c.heading}</h1>
          {c.sections.map((s) => (
            <section key={s.title} className="flex flex-col gap-2">
              <h2 className="text-lg font-extrabold text-neutral-900">{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-neutral-600">{p}</p>
              ))}
            </section>
          ))}
        </article>
      </main>
    </div>
  );
}
