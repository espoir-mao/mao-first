export const VISA_TYPES = [
  "investor",
  "employee",
  "golden",
  "family",
  "domestic",
  "remote",
] as const;

export type VisaType = (typeof VISA_TYPES)[number];

export const CONTRACT_TYPES = ["cdi", "cdd", "temps_partiel"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const GOLDEN_CATEGORIES = [
  "immobilier",
  "entrepreneur",
  "competences",
  "talents",
  "etudiants",
] as const;
export type GoldenCategory = (typeof GOLDEN_CATEGORIES)[number];

export const GOLDEN_DURATIONS = ["5", "10"] as const;
export type GoldenDuration = (typeof GOLDEN_DURATIONS)[number];

export const FAMILY_RELATIONS = ["epoux", "enfant", "parent"] as const;
export type FamilyRelation = (typeof FAMILY_RELATIONS)[number];

export const DOMESTIC_JOB_TYPES = [
  "menage",
  "nounou",
  "chauffeur",
  "cuisinier",
  "jardinier",
  "autre",
] as const;
export type DomesticJobType = (typeof DOMESTIC_JOB_TYPES)[number];

export const APPOINTMENT_SLOTS = ["matin", "apres_midi"] as const;
export type AppointmentSlot = (typeof APPOINTMENT_SLOTS)[number];

export const APPOINTMENT_STATUSES = ["a_planifier", "preference_envoyee"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/**
 * A short, invented list of typing-center / medical-fitness-center style
 * venues used purely as a selection list in the appointment step. These are
 * plausible-sounding placeholder names, not real, verified addresses — see
 * the info banner on that step for the disclaimer that nothing is actually
 * booked here.
 */
export const TYPING_CENTERS = [
  "al-barsha-medical",
  "al-qusais-typing",
  "deira-medical",
  "jebel-ali-typing",
  "sharjah-medical",
] as const;
export type TypingCenter = (typeof TYPING_CENTERS)[number];

/** Emirates list, kept in sync with the i18n `emirate.*` keys already used
 * by the société module (lib/freezones.ts) so both modules translate the
 * same way without duplicating translation entries. */
export const EMIRATES = [
  "Dubaï",
  "Abu Dhabi",
  "Sharjah",
  "Ajman",
  "Ras Al Khaimah",
  "Fujairah",
  "Umm Al Quwain",
] as const;

export interface VisaFeeLine {
  key: string;
  amount: number;
}

/**
 * Indicative, invented AED fee breakdown per visa type. Purely for display
 * on the payment-estimate step — no real payment is processed anywhere in
 * this module.
 */
export function getVisaFeeLines(visaType: VisaType): VisaFeeLine[] {
  const base: VisaFeeLine[] = [
    { key: "dossier", amount: 500 },
    { key: "emirates_id", amount: 370 },
    { key: "medical_biometric", amount: 700 },
  ];

  switch (visaType) {
    case "investor":
      return [...base, { key: "investor", amount: 2500 }];
    case "employee":
      return [...base, { key: "employee", amount: 1200 }];
    case "golden":
      return [...base, { key: "golden", amount: 4500 }];
    case "family":
      return [...base, { key: "family", amount: 1500 }];
    case "domestic":
      return [...base, { key: "domestic", amount: 900 }];
    case "remote":
      return [...base, { key: "remote", amount: 1000 }];
    default:
      return base;
  }
}

export function getVisaFeeTotal(visaType: VisaType): number {
  return getVisaFeeLines(visaType).reduce((sum, l) => sum + l.amount, 0);
}

export function generateTrackingReference(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `VISA-${y}${m}${d}-${rand}`;
}

/**
 * Typical UAE residence visa validity period per type (years), used only to
 * compute a plausible `expires_at` when a visa is marked "obtenu" via the
 * demo-only `simulateVisaDecision` action — not an authoritative figure.
 */
const VISA_VALIDITY_YEARS: Record<VisaType, number> = {
  investor: 2,
  employee: 2,
  golden: 5,
  family: 2,
  domestic: 2,
  remote: 1,
};

export function computeVisaExpiry(visaType: VisaType, decidedAt: Date): string {
  const expiry = new Date(decidedAt.getTime());
  expiry.setFullYear(expiry.getFullYear() + (VISA_VALIDITY_YEARS[visaType] ?? 2));
  return expiry.toISOString();
}

export function isVisaExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}
