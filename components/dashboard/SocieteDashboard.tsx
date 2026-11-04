"use client";

import { CorrectionBanner } from "../corrections/CompanyCorrections";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CompanyFile } from "@/lib/company-types";
import type { SupportTicket } from "@/lib/types";
import { companyDisplayName, statusBadgeClasses } from "@/lib/company-view";
import type { VisaApplication } from "@/lib/visa-types";
import { isLicenseExpired } from "@/lib/societe-constants";
import {
  activityByMonth,
  applicantName,
  buildDemoAccounting,
  completenessSteps,
  daysBetween,
  hasLicense,
  lastMonths,
  nextVatDeadline,
  visaDecision,
  visaFee,
} from "@/lib/dashboard";
import { useLanguage } from "../LanguageProvider";
import { FileIcon } from "../Icons";
import { BarChart, Donut, Gauge } from "./charts";
import SupportTickets from "./SupportTickets";

interface SocieteDashboardProps {
  societe: CompanyFile;
  visas: VisaApplication[];
  tickets: SupportTicket[];
}

function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-neutral-100 bg-white p-4 sm:p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            {title && <h2 className="text-base font-bold text-neutral-900">{title}</h2>}
            {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

function KpiTile({
  icon,
  label,
  value,
  sub,
  tone = "brand",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "brand" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    brand: "bg-[#eef4e4] text-[#4f7a37]",
    good: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-700",
    bad: "bg-red-100 text-red-700",
  }[tone];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-5">
      <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-semibold text-neutral-500">{label}</span>
        <span className="truncate text-xl font-extrabold leading-tight text-neutral-900">{value}</span>
        {sub && <span className="truncate text-[11px] text-neutral-500">{sub}</span>}
      </div>
    </div>
  );
}

const svgProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const IconFolder = () => (
  <svg {...svgProps}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
);
const IconLicense = () => (
  <svg {...svgProps}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
);
const IconVisa = () => (
  <svg {...svgProps}><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="12" r="2" /><path d="M14 10.5h4M14 13.5h4" /></svg>
);
const IconCoins = () => (
  <svg {...svgProps}><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8m0 8v1.5" /></svg>
);

export default function SocieteDashboard({ societe, visas, tickets }: SocieteDashboardProps) {
  const { t, lang, tEmirate } = useLanguage();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const now = useMemo(() => new Date(), []);

  const myVisas = useMemo(
    () => visas.filter((v) => v.company_id === societe.id),
    [visas, societe.id]
  );
  const [ticketState, setTicketState] = useState<SupportTicket[]>(() =>
    tickets.filter((tk) => tk.company_id === societe.id)
  );
  useEffect(() => {
    setTicketState(tickets.filter((tk) => tk.company_id === societe.id));
  }, [tickets, societe.id]);
  const myTickets = ticketState;
  const updateTicket = (updated: SupportTicket) =>
    setTicketState((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)));

  const aed = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale);

  /* ---- KPIs ---- */
  const license =
    hasLicense(societe) && societe.licence_expires_at
      ? { expires_at: societe.licence_expires_at }
      : null;
  const licenseExpired = license ? isLicenseExpired(license.expires_at) : false;
  const licenseDays = license ? daysBetween(now, new Date(license.expires_at)) : 0;

  const granted = myVisas.filter((v) => visaDecision(v) === "obtenu").length;
  const rejected = myVisas.filter((v) => visaDecision(v) === "rejete").length;
  const pending = myVisas.length - granted - rejected;
  const feesTotal = myVisas.reduce((s, v) => s + visaFee(v), 0);

  /* ---- Overview chart ---- */
  const accounting = useMemo(
    () => (societe.accounting ? buildDemoAccounting(societe.id, now, locale) : null),
    [societe.accounting, societe.id, now, locale]
  );
  const activityMonths = useMemo(() => lastMonths(now, 6, locale), [now, locale]);
  const activityValues = useMemo(
    () => activityByMonth(myVisas, myTickets, activityMonths),
    [myVisas, myTickets, activityMonths]
  );

  /* ---- Completeness ---- */
  const steps = completenessSteps(societe, myVisas);
  const doneSteps = steps.filter((s) => s.done).length;
  const percent = (doneSteps / steps.length) * 100;

  /* ---- Visas by type ---- */
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    myVisas.forEach((v) => m.set(v.visa_type, (m.get(v.visa_type) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [myVisas]);
  const maxType = Math.max(1, ...byType.map(([, n]) => n));

  /* ---- Deadlines ---- */
  const deadlines = useMemo(() => {
    const items: { key: string; label: string; date: Date; indicative?: boolean }[] = [];
    if (license) {
      items.push({ key: "license", label: t("dash.deadlines.license"), date: new Date(license.expires_at) });
    }
    myVisas
      .filter((v) => visaDecision(v) === "obtenu" && v.expires_at)
      .forEach((v) =>
        items.push({
          key: `visa-${v.id}`,
          label: t("dash.deadlines.visa", { name: applicantName(v) }),
          date: new Date(v.expires_at as string),
        })
      );
    if (societe.accounting) {
      items.push({ key: "vat", label: t("dash.deadlines.vat"), date: nextVatDeadline(now), indicative: true });
    }
    return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
  }, [license, myVisas, societe.accounting, now, t]);

  /* ---- Recent activity ---- */
  const activity = useMemo(() => {
    const items: { key: string; date: string; text: string }[] = [];
    (societe.status_history ?? []).forEach((h, i) =>
      items.push({
        key: `st-${i}`,
        date: h.changed_at,
        text: t("dash.activity.status", { status: t(`status.${h.status}`) }),
      })
    );
    (societe.licence_history ?? []).forEach((h, i) =>
      items.push({
        key: `lic-${i}`,
        date: h.changed_at,
        text: t(`dash.activity.license.${h.action}`, { number: h.number }),
      })
    );
    myVisas.forEach((v) => {
      items.push({ key: `v-${v.id}`, date: v.created_at, text: t("dash.activity.visaFiled", { name: applicantName(v) }) });
      const d = visaDecision(v);
      if (d !== "en_attente" && v.decided_at) {
        items.push({
          key: `vd-${v.id}`,
          date: v.decided_at,
          text: t(`dash.activity.visaDecision.${d}`, { name: applicantName(v) }),
        });
      }
    });
    myTickets.forEach((tk) =>
      items.push({ key: `tk-${tk.id}`, date: tk.created_at, text: t("dash.activity.ticket", { subject: tk.subject }) })
    );
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }, [societe.status_history, societe.licence_history, myVisas, myTickets, t]);

  const openTickets = myTickets.filter((tk) => tk.status === "ouvert").length;
  const shareholders = societe.shareholders ?? [];
  const documents = societe.documents ?? [];

  const visaSlices = [
    { key: "obtenu", label: t("visa.history.status.obtenu"), value: granted, color: "var(--viz-good)" },
    { key: "pending", label: t("dash.visaStatus.pending"), value: pending, color: "var(--viz-warn)" },
    { key: "rejete", label: t("visa.history.status.rejete"), value: rejected, color: "var(--viz-bad)" },
  ];

  const licenseValue = !license
    ? t("dash.kpi.license.none")
    : licenseExpired
    ? t("dash.kpi.license.expired")
    : t("dash.kpi.license.active");
  const licenseSub = !license
    ? t("dash.kpi.license.notIssued")
    : licenseExpired
    ? t("dash.kpi.license.expiredSince", { n: Math.abs(licenseDays) })
    : t("dash.kpi.license.daysLeft", { n: licenseDays });
  const licenseTone = !license ? "warn" : licenseExpired ? "bad" : licenseDays < 60 ? "warn" : "good";

  return (
    <div className="flex flex-col gap-4">
      <CorrectionBanner companyId={societe.id} />
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {companyDisplayName(societe) ?? t("company.draft.untitled")}
        </h1>
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pt-1">
          {societe.jurisdiction_type && (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-spring-200 px-2.5 py-1 text-xs font-bold text-[#3f5029]">
              {t(`jurisdiction.${societe.jurisdiction_type}`)}
            </span>
          )}
          {societe.authority && (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
              {societe.authority.name} · {tEmirate(societe.authority.emirate)}
            </span>
          )}
          {societe.licence_type && (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
              {societe.licence_type.label}
            </span>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          icon={<IconFolder />}
          label={t("dash.kpi.dossier")}
          value={t(`status.${societe.status}`)}
          sub={societe.tracking_reference ?? undefined}
          tone={
            societe.status === "LICENCE_ISSUED"
              ? "good"
              : societe.status === "REJECTED" || societe.status === "NAME_REJECTED"
              ? "bad"
              : societe.status === "DRAFT"
              ? "brand"
              : "warn"
          }
        />
        <KpiTile icon={<IconLicense />} label={t("dash.kpi.license")} value={licenseValue} sub={licenseSub} tone={licenseTone} />
        <KpiTile
          icon={<IconVisa />}
          label={t("dash.kpi.visas")}
          value={myVisas.length}
          sub={t("dash.kpi.visas.breakdown", { granted, pending, rejected })}
        />
        <KpiTile
          icon={<IconCoins />}
          label={t("dash.kpi.fees")}
          value={aed(feesTotal)}
          sub={t("dash.kpi.fees.count", { n: myVisas.length })}
        />
      </div>

      {/* Overview + profile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {accounting ? (
          <Card
            title={t("dash.overview.accounting.title")}
            subtitle={t("dash.overview.last12")}
            right={
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                {t("dash.overview.demoBadge")}
              </span>
            }
          >
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t("dash.overview.revenue"), value: aed(accounting.revenueTotal) },
                { label: t("dash.overview.expenses"), value: aed(accounting.expensesTotal) },
                { label: t("dash.overview.result"), value: aed(accounting.resultTotal) },
                { label: t("dash.overview.vat"), value: aed(accounting.vatQuarter) },
              ].map((s) => (
                <div key={s.label} className="flex flex-col gap-0.5 rounded-xl bg-neutral-50 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-neutral-500">{s.label}</span>
                  <span className="truncate text-sm font-extrabold text-neutral-900">{s.value}</span>
                </div>
              ))}
            </div>
            <BarChart
              ariaLabel={t("dash.overview.accounting.title")}
              locale={locale}
              formatValue={aed}
              series={[
                { key: "rev", label: t("dash.overview.revenue"), color: "var(--viz-1)" },
                { key: "exp", label: t("dash.overview.expenses"), color: "var(--viz-2)" },
              ]}
              data={accounting.months.map((m, i) => ({
                label: m.label,
                values: [accounting.revenue[i], accounting.expenses[i]],
              }))}
            />
            <p className="mt-3 text-[11px] text-neutral-500">{t("dash.overview.disclaimer")}</p>
          </Card>
        ) : (
          <Card title={t("dash.overview.activity.title")} subtitle={t("dash.overview.activity.sub")}>
            <BarChart
              ariaLabel={t("dash.overview.activity.series")}
              locale={locale}
              series={[{ key: "act", label: t("dash.overview.activity.series"), color: "var(--viz-1)" }]}
              data={activityMonths.map((m, i) => ({ label: m.label, values: [activityValues[i]] }))}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
              <span className="text-xs text-neutral-600">{t("dash.overview.noAccounting")}</span>
              <Link
                href={`/societes/${societe.id}/modifier`}
                className="text-xs font-bold text-[#4f7a37] hover:underline"
              >
                {t("dash.overview.enableAccounting")}
              </Link>
            </div>
          </Card>
        )}

        <Card title={t("dash.completeness.title")}>
          <Gauge percent={percent} ariaLabel={t("dash.completeness.steps", { done: doneSteps, total: steps.length })} />
          <p className="-mt-1 text-center text-xs text-neutral-500">
            {t("dash.completeness.steps", { done: doneSteps, total: steps.length })}
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {steps.map((s) => (
              <li key={s.key} className="flex items-center gap-2.5 text-sm">
                <span
                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: s.done ? "var(--viz-good)" : "var(--viz-neutral)" }}
                  aria-hidden="true"
                >
                  {s.done ? "✓" : ""}
                </span>
                <span className={s.done ? "text-neutral-900" : "text-neutral-500"}>
                  {t(`dash.step.${s.key}`)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Visas + deadlines */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t("dash.visaStatus.title")}>
          {myVisas.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("dash.visaStatus.empty")}</p>
          ) : (
            <Donut
              slices={visaSlices}
              centerValue={String(myVisas.length)}
              centerLabel={t("dash.kpi.visas")}
              ariaLabel={t("dash.visaStatus.title")}
            />
          )}
        </Card>

        <Card title={t("dash.visaType.title")}>
          {byType.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("dash.visaStatus.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {byType.map(([type, n]) => (
                <li key={type} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-800">{t(`visa.type.${type}.label`)}</span>
                    <span className="font-bold text-neutral-900">{n}</span>
                  </div>
                  <div className="h-2 w-full rounded-full" style={{ background: "var(--viz-track)" }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${(n / maxType) * 100}%`, background: "var(--viz-1)" }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("dash.deadlines.title")}>
          {deadlines.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("dash.deadlines.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {deadlines.map((d) => {
                const days = daysBetween(now, d.date);
                const late = days < 0;
                return (
                  <li key={d.key} className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-neutral-100 text-[10px] font-bold uppercase leading-none text-neutral-500">
                      <span className="text-sm text-neutral-900">{d.date.getDate()}</span>
                      {d.date.toLocaleDateString(locale, { month: "short" })}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm text-neutral-800">
                        {d.label}
                        {d.indicative && (
                          <span className="ml-1.5 text-[11px] text-neutral-400">({t("dash.deadlines.indicative")})</span>
                        )}
                      </span>
                      <span
                        className={`text-xs font-semibold ${late ? "text-red-600" : days < 30 ? "text-amber-700" : "text-neutral-500"}`}
                      >
                        {late
                          ? t("dash.deadlines.overdue", { n: Math.abs(days) })
                          : t("dash.deadlines.inDays", { n: days })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Activity + support */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t("dash.activity.title")}>
          {activity.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("dash.activity.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {activity.map((a) => {
                const d = new Date(a.date);
                return (
                  <li key={a.key} className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-neutral-100 text-[10px] font-bold uppercase leading-none text-neutral-500">
                      <span className="text-sm text-neutral-900">{d.getDate()}</span>
                      {d.toLocaleDateString(locale, { month: "short" })}
                    </span>
                    <span className="pt-1 text-sm text-neutral-700">{a.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title={t("dash.support.title")}
          right={
            <Link href="/contact" className="text-xs font-bold text-[#4f7a37] hover:underline">
              {t("dash.support.contact")}
            </Link>
          }
        >
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col rounded-xl bg-neutral-50 px-3 py-2.5">
              <span className="text-[11px] font-semibold text-neutral-500">{t("dash.support.open")}</span>
              <span className="text-xl font-extrabold text-neutral-900">{openTickets}</span>
            </div>
            <div className="flex flex-col rounded-xl bg-neutral-50 px-3 py-2.5">
              <span className="text-[11px] font-semibold text-neutral-500">{t("dash.support.resolved")}</span>
              <span className="text-xl font-extrabold text-neutral-900">{myTickets.length - openTickets}</span>
            </div>
          </div>
          {myTickets.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("dash.support.empty")}</p>
          ) : (
            <SupportTickets
              societeId={societe.id}
              tickets={myTickets}
              locale={locale}
              onChange={updateTicket}
            />
          )}
        </Card>
      </div>

      {/* Payments + shareholders/documents */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card title={t("dash.payments.title")} subtitle={t("dash.payments.subtitle")}>
        {myVisas.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("dash.payments.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                  <th className="pb-2 pr-3">{t("dash.payments.col.ref")}</th>
                  <th className="pb-2 pr-3">{t("dash.payments.col.applicant")}</th>
                  <th className="pb-2 pr-3">{t("dash.payments.col.type")}</th>
                  <th className="pb-2 pr-3">{t("dash.payments.col.date")}</th>
                  <th className="pb-2 pr-3 text-right">{t("dash.payments.col.total")}</th>
                  <th className="pb-2 text-right">{t("dash.payments.col.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {myVisas.map((v) => {
                  const d = visaDecision(v);
                  return (
                    <tr key={v.id}>
                      <td className="py-2.5 pr-3 text-neutral-600">{v.tracking_reference ?? "—"}</td>
                      <td className="py-2.5 pr-3 font-semibold text-neutral-800">{applicantName(v)}</td>
                      <td className="py-2.5 pr-3 text-neutral-600">{t(`visa.type.${v.visa_type}.label`)}</td>
                      <td className="py-2.5 pr-3 text-neutral-600">{fmtDate(v.created_at)}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-neutral-900">
                        {visaFee(v).toLocaleString(locale)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                            d === "obtenu"
                              ? "bg-emerald-100 text-emerald-700"
                              : d === "rejete"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {d === "obtenu"
                            ? t("visa.history.status.obtenu")
                            : d === "rejete"
                            ? t("visa.history.status.rejete")
                            : t("dash.visaStatus.pending")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200">
                  <td colSpan={4} className="pt-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
                    {t("dash.payments.total")}
                  </td>
                  <td className="pt-3 text-right font-extrabold tabular-nums text-neutral-900">
                    {feesTotal.toLocaleString(locale)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-neutral-500">{t("dash.payments.disclaimer")}</p>
      </Card>

      <div className="flex flex-col gap-4">
        <Card title={t("home.dashboard.shareholders.title")}>
          {shareholders.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("home.dashboard.shareholders.empty")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-neutral-100">
              {shareholders.map((sh, index) => (
                <div key={sh.id} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
                  <span className="text-sm font-semibold text-neutral-900">
                    {sh.person ? `${sh.person.first_name} ${sh.person.last_name}` : sh.parent_company?.name ?? "—"}
                    {sh.is_manager ? ` · ${t("company.holder.manager")}` : ""}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {Number(sh.share_pct)} %
                    {sh.person?.email ? ` · ${sh.person.email}` : ""}
                    {sh.person?.phone ? ` · ${sh.person.phone}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={t("home.dashboard.documents.title")}>
          {documents.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("home.dashboard.documents.empty")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5"
                >
                  <FileIcon className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm text-neutral-800 hover:text-[#4a5f34]"
                  >
                    {doc.file_name || doc.file_url}
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      </div>

      <div className="flex flex-col flex-wrap items-stretch gap-3 sm:flex-row sm:items-center">
        <Link
          href={`/societes/${societe.id}/modifier`}
          className="flex items-center justify-center gap-2 rounded-full bg-[#7a9a5a] px-6 py-3 text-center text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95"
        >
          {t("home.dashboard.actions.edit")}
        </Link>
        <Link
          href="/choisir-societe"
          className="flex items-center justify-center gap-2 rounded-full border border-[#7a9a5a] px-6 py-3 text-center text-sm font-extrabold text-[#4f7a37] transition hover:bg-[#f2f6ec]"
        >
          {t("home.dashboard.actions.switch")}
        </Link>
        <Link
          href="/societes"
          className="flex items-center justify-center gap-2 px-2 py-3 text-center text-sm font-bold text-neutral-500 underline-offset-2 transition hover:text-neutral-800 hover:underline"
        >
          {t("home.dashboard.actions.viewAll")}
        </Link>
      </div>
    </div>
  );
}
