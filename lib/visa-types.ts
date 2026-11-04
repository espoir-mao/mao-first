import type { VisaType } from "./visa-constants";

export type VisaStepId =
  | "applicant"
  | "type"
  | "branch"
  | "documents"
  | "appointments"
  | "address"
  | "review"
  | "payment";

export interface VisaApplicant {
  nom: string;
  prenom: string;
  nationalite: string;
  date_naissance: string;
  numero_passeport: string;
  email: string;
  telephone: string;
}

export interface VisaDependent {
  nom: string;
  prenom: string;
  lien: string;
  date_naissance: string;
}

export interface VisaBranchData {
  // investor
  role_societe?: string;
  pourcentage_participation?: number | null;
  // employee
  poste?: string;
  salaire_mensuel?: number | null;
  type_contrat?: string;
  // golden
  golden_categorie?: string;
  golden_duree?: string;
  golden_justificatif?: string;
  // family
  family_lien_sponsor?: string;
  sponsor_nom?: string;
  sponsor_prenom?: string;
  sponsor_id_numero?: string;
  dependents?: VisaDependent[];
  // domestic
  domestic_poste?: string;
  domestic_sponsor_nom?: string;
  domestic_foyer_adresse?: string;
  domestic_mohre_numero?: string;
  // remote
  remote_employeur_nom?: string;
  remote_employeur_pays?: string;
  remote_revenu_minimum?: number | null;
  remote_preuve_emploi?: string;
}

export interface VisaDocument {
  name: string;
  path: string;
  url: string;
  size: number;
}

export interface VisaAppointment {
  date: string;
  slot: string;
  center: string;
  status: "a_planifier" | "preference_envoyee";
  notified_at: string | null;
}

export interface VisaAddress {
  address_line1: string;
  address_line2: string;
  city: string;
  emirate: string;
  po_box: string;
  phone: string;
}

export interface VisaFeeEstimate {
  items: { key: string; amount: number }[];
  total: number;
}

/**
 * Final decision on the visa request — separate from `status` (which only
 * tracks the application form itself, e.g. "soumis"). Never automatic: this
 * app has no real government/authority integration, so it only moves away
 * from "en_attente" through the demo-only `simulateVisaDecision` action (see
 * app/actions/visa.ts), surfaced on the "Historique" sidebar sub-page.
 */
export type VisaDecisionStatus = "en_attente" | "obtenu" | "rejete";

export interface VisaApplication {
  id: string;
  created_at: string;
  updated_at: string;
  visa_type: VisaType;
  applicant: VisaApplicant;
  company_id: string | null;
  branch_data: VisaBranchData;
  documents: VisaDocument[];
  medical_appointment: VisaAppointment;
  biometric_appointment: VisaAppointment;
  emirates_id_address: VisaAddress;
  status: string;
  tracking_reference: string | null;
  payment_estimate: VisaFeeEstimate;
  decision_status: VisaDecisionStatus;
  /** Date the decision (obtention or rejet) was made, null while en_attente. */
  decided_at: string | null;
  /** Visa validity end date, only set when decision_status is "obtenu". */
  expires_at: string | null;
}
