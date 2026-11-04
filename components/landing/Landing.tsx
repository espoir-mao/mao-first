"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Flag from "../Flag";
import { useLanguage } from "../LanguageProvider";

type Lang = "fr" | "en";

const CONTENT: Record<
  Lang,
  {
    nav: { about: string; expertises: string; login: string; signup: string; project: string };
    slides: { tab: string; title: string; sub: string }[];
    cta: string;
    expertisesTitle: string;
    aboutTitle: string;
    aboutBody: string;
  }
> = {
  fr: {
    nav: { about: "À propos", expertises: "Expertises", login: "Se connecter", signup: "Créer un compte", project: "Parlons de votre projet" },
    slides: [
      { tab: "Création de société aux Émirats", title: "Créez votre société en mainland et en free zone", sub: "Choisissez en fonction de VOS besoins et de VOTRE forme juridique" },
      { tab: "Gestion de visas", title: "Visas investisseur, salarié et famille - MAO vous accompagne", sub: "Accompagnement sur mesure et à votre rythme" },
      { tab: "Comptabilité", title: "Comptabilité, TVA - Écoute et transparence tout au long de votre projet", sub: "Engagement maximal et un succès de votre société" },
    ],
    cta: "Découvrez nos services",
    expertisesTitle: "Nos trois expertises",
    aboutTitle: "À propos de MAO",
    aboutBody: "MAO - My Accountant Online - réunit en un seul endroit la création de votre société aux Émirats arabes unis, la gestion de vos visas et votre comptabilité. Tout votre back-office, dans un seul abonnement.",
  },
  en: {
    nav: { about: "About", expertises: "Expertise", login: "Log in", signup: "Create an account", project: "Let's talk about your project" },
    slides: [
      { tab: "Company formation in the UAE", title: "Set up your company in mainland and free zone", sub: "Choose according to YOUR needs and YOUR legal form" },
      { tab: "Visa management", title: "Investor, employee and family visas - MAO supports you", sub: "Tailor-made support at your own pace" },
      { tab: "Accounting", title: "Accounting, VAT - Listening and transparency throughout your project", sub: "Maximum commitment and the success of your company" },
    ],
    cta: "Discover our services",
    expertisesTitle: "Our three areas of expertise",
    aboutTitle: "About MAO",
    aboutBody: "MAO - My Accountant Online - brings together in one place your company formation in the United Arab Emirates, your visa management and your accounting. All your back-office, in a single subscription.",
  },
};

const BG = "bg-[#0d1e27]";

function Check() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function Landing() {
  const { lang, setLang } = useLanguage();
  const c = CONTENT[lang];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = c.slides.length;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % n), 6000);
    return () => clearInterval(id);
  }, [paused, n]);

  const go = (i: number) => setIndex(((i % n) + n) % n);
  const next = lang === "fr" ? "en" : "fr";

  return (
    <div className={`flex min-h-screen w-full flex-col ${BG} text-white`}>
      {/* header */}
      <header className={`sticky top-0 z-30 w-full ${BG}`}>
        <div className="mx-auto flex h-[76px] w-full max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="MAO" className="flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mao-logo-dark.png" alt="MAO" width={178} height={54} className="h-10 w-auto" />
          </Link>
          <nav className="flex items-center gap-2 text-sm font-bold sm:gap-4" aria-label="Main">
            <a href="#a-propos" className="hidden rounded-full px-3 py-2 hover:bg-white/10 md:block">{c.nav.about}</a>
            <div className="group relative hidden md:block">
              <button type="button" className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-white/10">
                {c.nav.expertises}
                <span aria-hidden="true" className="text-[10px]">▼</span>
              </button>
              <div className="invisible absolute left-0 top-full z-40 w-72 rounded-2xl bg-white p-2 text-neutral-900 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                {c.slides.map((s, i) => (
                  <a key={s.tab} href="#expertises" onClick={() => go(i)} className="block rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-neutral-100">
                    {s.tab}
                  </a>
                ))}
              </div>
            </div>
            <Link href="/login" className="hidden rounded-full px-3 py-2 hover:bg-white/10 sm:block">{c.nav.login}</Link>
            <Link href="/inscription" className="flex items-center gap-2 rounded-full border border-white px-4 py-2.5 transition hover:bg-white hover:text-[#0d1e27] sm:px-5">
              {c.nav.signup}
              <svg className="hidden h-4 w-4 sm:block" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="9" cy="8" r="4" />
                <path d="M2 20c0-4 3-6 7-6s7 2 7 6zM19 7v6M16 10h6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </Link>
            <Link href="/contact" className="hidden items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[#0d1e27] transition hover:bg-[#e4ecd8] lg:flex">
              {c.nav.project}
              <span aria-hidden="true">→</span>
            </Link>
            <button type="button" onClick={() => setLang(next)} aria-label={next === "en" ? "English" : "Français"} className="rounded-full bg-white/10 px-2.5 py-2 leading-none hover:bg-white/20">
              <Flag lang={lang} className="rounded-[2px]" />
            </button>
          </nav>
        </div>
      </header>

      {/* hero slider */}
      <section
        className="relative w-full overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-roledescription="carousel"
      >
        <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${index * 100}%)` }}>
          {c.slides.map((s, i) => (
            <div key={s.tab} className="relative flex min-h-[460px] w-full flex-shrink-0 items-center sm:min-h-[560px]" aria-hidden={i !== index}>
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id={`g${i}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#16323f" />
                    <stop offset="1" stopColor="#0d1e27" />
                  </linearGradient>
                </defs>
                <rect width="1200" height="600" fill={`url(#g${i})`} />
                <circle cx={950 - i * 120} cy="180" r="260" fill="#9AE22F" opacity="0.07" />
                <circle cx={1050 - i * 80} cy="470" r="170" fill="#9AE22F" opacity="0.1" />
                <path d={`M${700 + i * 40} 600L${900 + i * 40} 300L${1000 + i * 40} 420L1200 160V600Z`} fill="#9AE22F" opacity="0.08" />
              </svg>
              <div className="relative z-10 mx-auto w-full max-w-6xl px-16 sm:px-20">
                <h2 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">{s.title}</h2>
                <p className="mt-6 max-w-2xl text-base text-[#d8e2d8] sm:text-lg">{s.sub}</p>
                <a href="#expertises" className="mt-8 inline-block rounded-full bg-[#9AE22F] px-7 py-3.5 text-sm font-bold text-[#0d1e27] transition hover:brightness-95">
                  {c.cta}
                </a>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => go(index - 1)} aria-label="Previous" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-3 text-2xl hover:bg-white/10 sm:left-8">‹</button>
        <button type="button" onClick={() => go(index + 1)} aria-label="Next" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-3 text-2xl hover:bg-white/10 sm:right-8">›</button>
        <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
          {c.slides.map((s, i) => (
            <button key={s.tab} type="button" onClick={() => go(i)} aria-label={s.tab} className={`h-2 w-2 rounded-full ${i === index ? "bg-white" : "bg-white/40"}`} />
          ))}
        </div>
      </section>

      {/* three expertises */}
      <section id="expertises" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-14">
        <h2 className="sr-only">{c.expertisesTitle}</h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {c.slides.map((s, i) => (
            <button key={s.tab} type="button" onClick={() => go(i)} className="group flex flex-col items-center gap-4 text-center" aria-pressed={i === index}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2a3a45] text-white"><Check /></span>
              <span className="text-base font-bold sm:text-lg">{s.tab}</span>
              <span className="relative h-px w-full max-w-[210px] bg-white/15">
                <span className={`absolute left-1/2 top-1/2 h-[3px] w-14 -translate-x-1/2 -translate-y-1/2 rounded-full transition ${i === index ? "bg-white" : "bg-transparent group-hover:bg-white/40"}`} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* about */}
      <section id="a-propos" className="mx-auto w-full max-w-3xl scroll-mt-20 px-5 pb-20 text-center">
        <h2 className="text-2xl font-extrabold sm:text-3xl">{c.aboutTitle}</h2>
        <p className="mt-4 text-base leading-relaxed text-[#d8e2d8]">{c.aboutBody}</p>
        <Link href="/inscription" className="mt-8 inline-block rounded-full bg-white px-7 py-3.5 text-sm font-bold text-[#0d1e27] transition hover:bg-[#e4ecd8]">
          {c.nav.signup} →
        </Link>
      </section>
    </div>
  );
}
