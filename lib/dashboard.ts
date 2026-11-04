import type { CompanyFile } from "@/lib/company-types";
import type { SupportTicket } from "@/lib/types";
import type { VisaApplication } from "@/lib/visa-types";

/**
 * Pure helpers behind the société dashboard (components/dashboard). Everything
 * here derives from data the app really stores (société row, linked visas,
 * support tickets) EXCEPT `buildDemoAccounting`, which fabricates illustrative
 * accounting figures — there is no accounting backend — and is always shown
 * with a "demo data" badge.
 */

const DAY_MS = 86_400_000;

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function applicantName(visa: VisaApplication): string {
  const name = `${visa.applicant?.prenom ?? ""} ${visa.applicant?.nom ?? ""}`.trim();
  return name || visa.tracking_reference || visa.id;
}

export function hasLicense(societe: CompanyFile): boolean {
  return Boolean(societe.licence_number);
}

export function visaDecision(visa: VisaApplication): "en_attente" | "obtenu" | "rejete" {
  return (visa.decision_status ?? "en_attente") as "en_attente" | "obtenu" | "rejete";
}

export function visaFee(visa: VisaApplication): number {
  return Number(visa.payment_estimate?.total ?? 0);
}

export interface MonthBucket {
  key: string; // YYYY-MM
  label: string; // localized short month
  date: Date;
}

/** The last `count` calendar months ending with the month of `now`, oldest first. */
export function lastMonths(now: Date, count: number, locale: string): MonthBucket[] {
  const out: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString(locale, { month: "short" }),
      date: d,
    });
  }
  return out;
}

export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Requests (visa filings + support messages) per month — real data. */
export function activityByMonth(
  visas: VisaApplication[],
  tickets: SupportTicket[],
  months: MonthBucket[]
): number[] {
  const counts = new Map(months.map((m) => [m.key, 0]));
  for (const v of visas) {
    const k = monthKey(v.created_at);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const tk of tickets) {
    const k = monthKey(tk.created_at);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return months.map((m) => counts.get(m.key) ?? 0);
}

export interface Step {
  key: string;
  done: boolean;
}

export function completenessSteps(societe: CompanyFile, visas: VisaApplication[]): Step[] {
  return [
    { key: "submitted", done: societe.status !== "DRAFT" },
    { key: "validated", done: ["NAME_APPROVED", "INITIAL_APPROVAL", "LICENCE_ISSUED"].indexOf(societe.status) !== -1 },
    { key: "license", done: hasLicense(societe) },
    { key: "shareholders", done: (societe.shareholders ?? []).length > 0 },
    { key: "documents", done: (societe.documents ?? []).length > 0 },
    { key: "visa", done: visas.length > 0 },
  ];
}

/* ------------------------------------------------------------------ demo */

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoAccounting {
  months: MonthBucket[];
  revenue: number[];
  expenses: number[];
  revenueTotal: number;
  expensesTotal: number;
  resultTotal: number;
  thisMonthResult: number;
  vatQuarter: number;
}

/**
 * ILLUSTRATIVE accounting figures, deterministic per société id so they stay
 * stable across reloads. Not real data — callers must label it as demo.
 */
export function buildDemoAccounting(
  societeId: string,
  now: Date,
  locale: string
): DemoAccounting {
  const rand = mulberry32(hashSeed(societeId));
  const months = lastMonths(now, 12, locale);
  const base = 45_000 + Math.round(rand() * 60_000);
  const revenue: number[] = [];
  const expenses: number[] = [];
  months.forEach((_, i) => {
    const wave = 1 + 0.18 * Math.sin((i / 12) * Math.PI * 2 + rand());
    const growth = 1 + i * 0.015;
    const rev = Math.round((base * wave * growth * (0.9 + rand() * 0.2)) / 100) * 100;
    const exp = Math.round((rev * (0.55 + rand() * 0.25)) / 100) * 100;
    revenue.push(rev);
    expenses.push(exp);
  });
  const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
  const last = revenue.length - 1;
  return {
    months,
    revenue,
    expenses,
    revenueTotal: sum(revenue),
    expensesTotal: sum(expenses),
    resultTotal: sum(revenue) - sum(expenses),
    thisMonthResult: revenue[last] - expenses[last],
    // UAE standard VAT rate is 5%.
    vatQuarter: Math.round(sum(revenue.slice(-3)) * 0.05),
  };
}

/** Next quarterly VAT return date: 28 days after the next quarter end. */
export function nextVatDeadline(now: Date): Date {
  for (let offset = 0; offset < 8; offset++) {
    const qEndMonth = Math.floor(now.getMonth() / 3) * 3 + 2 + offset * 3;
    const qEnd = new Date(now.getFullYear(), qEndMonth + 1, 0);
    const due = new Date(qEnd.getTime() + 28 * DAY_MS);
    if (due.getTime() >= now.getTime() - 7 * DAY_MS) return due;
  }
  return now;
}

/** Nice axis ceiling and ticks for a chart (4 intervals). */
export function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
  const top = step * 4;
  return { top, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
}

export function compact(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
