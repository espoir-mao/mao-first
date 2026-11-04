"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useLanguage } from "../LanguageProvider";
import { useActiveSociete } from "@/lib/active-societe";
import { createContactTicket } from "@/app/actions/support";
import { validateContact } from "@/lib/contact";
import type { SupportTicket } from "@/lib/types";

const CONTACT_EMAIL = "contact@mao.com";
const CONTACT_PHONE_DISPLAY = "09 78 28 83 10";
const CONTACT_PHONE_HREF = "tel:0978288310";
const CONTACT_OFFICE = "DUBAI";

const inputCls =
  "w-full rounded-full border border-transparent bg-white px-6 py-4 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-[#7a9a5a]";

const iconCls = "h-5 w-5";
function InfoBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#0f1e26] text-white dark:bg-[#2a3a20]">{icon}</span>
        <h2 className="text-lg font-extrabold text-neutral-900">{title}</h2>
      </div>
      <div className="flex flex-col gap-1 pl-1 text-sm text-neutral-600">{children}</div>
    </div>
  );
}

/**
 * "Nous contacter": open to everyone, including visitors without an account,
 * so the person identifies themselves (name, e-mail, phone, company). A signed-in
 * person gets those fields pre-filled (and stays editable). The message is
 * logged as a support ticket, handled in Backoffice MAO > Gestion de demandes;
 * no real e-mail is sent.
 */
export default function ContactForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const { activeSociete } = useActiveSociete();
  const [isVisitor, setIsVisitor] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();

  // signed-in person: pre-fill the identification
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        const u = data.session?.user;
        if (!u) return;
        setIsVisitor(false);
        setFirstName((v) => v || ((u.user_metadata?.first_name as string | undefined) ?? ""));
        setLastName((v) => v || ((u.user_metadata?.last_name as string | undefined) ?? ""));
        setEmail((v) => v || (u.email ?? ""));
        setPhone((v) => v || ((u.user_metadata?.phone as string | undefined) ?? ""));
      });
  }, []);
  useEffect(() => {
    if (activeSociete) setCompany((v) => v || activeSociete.name);
  }, [activeSociete]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const issues = validateContact({ first_name: firstName, last_name: lastName, email, phone, company, subject, message });
    if (issues.length > 0) {
      setError(t(`contact.issue.${issues[0]}`));
      return;
    }
    startSubmitting(async () => {
      const result = await createContactTicket({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        company_name: company,
        // the société is only attached when the person's company is the active one
        company_id: !isVisitor && activeSociete && company.trim() === activeSociete.name ? activeSociete.id : null,
        subject,
        message,
        is_visitor: isVisitor,
        website,
      });
      if (!result.success || !result.data) {
        const code = result.issues?.[0]?.code;
        setError(code ? t(`contact.issue.${code}`) : (result.error ?? t("contact.error.generic")));
        return;
      }
      setTicket(result.data);
    });
  }

  const left = (
    <div className="flex flex-col gap-8">
      <Link
        href="/"
        className="flex w-fit items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-900 transition hover:border-[#7a9a5a]"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
        </svg>
        {t("contact.home")}
      </Link>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">{t("contact.heading")}</h1>
        <p className="max-w-xl text-base text-neutral-600">{t("contact.intro")}</p>
      </div>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <InfoBlock
          title={t("contact.info.email")}
          icon={
            <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9 6 9-6M3 9v10h18V9M3 9l9-6 9 6" />
            </svg>
          }
        >
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">{CONTACT_EMAIL}</a>
        </InfoBlock>
        <InfoBlock
          title={t("contact.info.phone")}
          icon={
            <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
            </svg>
          }
        >
          <a href={CONTACT_PHONE_HREF} className="hover:underline">{CONTACT_PHONE_DISPLAY}</a>
        </InfoBlock>
        <InfoBlock
          title={t("contact.info.office")}
          icon={
            <svg className={iconCls} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" />
            </svg>
          }
        >
          <span>{CONTACT_OFFICE}</span>
        </InfoBlock>
      </div>
    </div>
  );

  const req = " *";
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
      {ticket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="contact-popup-title">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700" aria-hidden="true">✓</span>
            <h2 id="contact-popup-title" className="mt-4 text-xl font-extrabold text-neutral-900">{t("contact.popup.title")}</h2>
            <p className="mt-2 text-sm text-neutral-600">{t("contact.popup.body")}</p>
            <p className="mt-1 text-xs text-neutral-500">{t("contact.ticketRef", { ref: ticket.reference })}</p>
            <button
              type="button"
              autoFocus
              onClick={() => router.push("/")}
              className="mt-6 w-full rounded-full bg-[#0f1e26] px-6 py-3 text-sm font-bold text-white transition hover:brightness-125 dark:bg-[#7a9a5a] dark:text-[#0d0f0c]"
            >
              {t("contact.popup.home")}
            </button>
          </div>
        </div>
      )}
      {left}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input aria-label={t("contact.firstName.label")} placeholder={t("contact.firstName.label") + req} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={inputCls} />
          <input aria-label={t("contact.lastName.label")} placeholder={t("contact.lastName.label") + req} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={inputCls} />
          <input aria-label={t("contact.email.label")} type="email" placeholder={t("contact.email.label") + req} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
          <input aria-label={t("contact.phone.label")} type="tel" placeholder={t("contact.phone.label")} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className={inputCls} />
          <input aria-label={t("contact.company.label")} placeholder={t("contact.company.label")} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" className={inputCls} />
          <input aria-label={t("contact.subject.label")} placeholder={t("contact.subject.label") + req} value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
        </div>
        <textarea
          aria-label={t("contact.message.label")}
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("contact.message.label") + req}
          className={`${inputCls} !rounded-3xl`}
        />

        {/* honeypot: hidden from people */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-fit items-center gap-3 rounded-full bg-[#0f1e26] px-8 py-4 text-sm font-bold text-white transition hover:brightness-125 disabled:opacity-60 dark:bg-[#7a9a5a] dark:text-[#0d0f0c]"
          >
            {isSubmitting ? t("contact.submitting") : t("contact.submit")}
            <span aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-full border border-[#0f1e26] px-8 py-4 text-sm font-bold text-neutral-900 transition hover:bg-white dark:border-[#7a9a5a]"
          >
            {t("contact.cancel")}
          </button>
        </div>

        <p className="text-xs text-neutral-500">{t("contact.disclaimer")}</p>
      </form>
    </div>
  );
}
