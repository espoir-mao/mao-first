import { z } from "zod";
import {
  VISA_TYPES,
  CONTRACT_TYPES,
  GOLDEN_CATEGORIES,
  GOLDEN_DURATIONS,
  FAMILY_RELATIONS,
  DOMESTIC_JOB_TYPES,
  APPOINTMENT_SLOTS,
  APPOINTMENT_STATUSES,
  TYPING_CENTERS,
} from "./visa-constants";

const PHONE_REGEX = /^[+0-9][0-9 ().-]{5,20}$/;

const visaDocumentSchema = z.object({
  name: z.string(),
  path: z.string(),
  url: z.string(),
  size: z.number(),
});

export const applicantSchema = z.object({
  nom: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères."),
  prenom: z
    .string()
    .trim()
    .min(2, "Le prénom doit contenir au moins 2 caractères."),
  nationalite: z
    .string()
    .trim()
    .min(2, "Précisez la nationalité du demandeur."),
  date_naissance: z.string().min(1, "Indiquez la date de naissance."),
  numero_passeport: z
    .string()
    .trim()
    .min(4, "Numéro de passeport invalide."),
  email: z.string().trim().email("Adresse e-mail invalide."),
  telephone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, "Numéro de téléphone invalide."),
});

const dependentSchema = z.object({
  nom: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères."),
  prenom: z
    .string()
    .trim()
    .min(2, "Le prénom doit contenir au moins 2 caractères."),
  lien: z.string().trim().min(2, "Précisez le lien de parenté."),
  date_naissance: z.string().min(1, "Indiquez la date de naissance."),
});

const branchSchema = z
  .object({
    role_societe: z.string().trim().optional().default(""),
    pourcentage_participation: z
      .number()
      .min(0)
      .max(100)
      .nullable()
      .optional()
      .default(null),
    poste: z.string().trim().optional().default(""),
    salaire_mensuel: z.number().min(0).nullable().optional().default(null),
    type_contrat: z.enum(CONTRACT_TYPES).optional().or(z.literal("")),
    golden_categorie: z
      .enum(GOLDEN_CATEGORIES)
      .optional()
      .or(z.literal("")),
    golden_duree: z.enum(GOLDEN_DURATIONS).optional().or(z.literal("")),
    golden_justificatif: z.string().trim().optional().default(""),
    family_lien_sponsor: z
      .enum(FAMILY_RELATIONS)
      .optional()
      .or(z.literal("")),
    sponsor_nom: z.string().trim().optional().default(""),
    sponsor_prenom: z.string().trim().optional().default(""),
    sponsor_id_numero: z.string().trim().optional().default(""),
    dependents: z.array(dependentSchema).default([]),
    domestic_poste: z
      .enum(DOMESTIC_JOB_TYPES)
      .optional()
      .or(z.literal("")),
    domestic_sponsor_nom: z.string().trim().optional().default(""),
    domestic_foyer_adresse: z.string().trim().optional().default(""),
    domestic_mohre_numero: z.string().trim().optional().default(""),
    remote_employeur_nom: z.string().trim().optional().default(""),
    remote_employeur_pays: z.string().trim().optional().default(""),
    remote_revenu_minimum: z.number().min(0).nullable().optional().default(null),
    remote_preuve_emploi: z.string().trim().optional().default(""),
  })
  .default({});

const appointmentSchema = z
  .object({
    date: z.string().optional().default(""),
    slot: z.enum(APPOINTMENT_SLOTS).optional().or(z.literal("")),
    center: z.enum(TYPING_CENTERS).optional().or(z.literal("")),
    status: z.enum(APPOINTMENT_STATUSES).default("a_planifier"),
    notified_at: z.string().nullable().optional().default(null),
  })
  .default({ status: "a_planifier" });

const addressSchema = z.object({
  address_line1: z
    .string()
    .trim()
    .min(3, "L'adresse (ligne 1) est requise."),
  address_line2: z.string().trim().optional().default(""),
  city: z.string().trim().min(2, "La ville est requise."),
  emirate: z.string().min(1, "Sélectionnez un émirat."),
  po_box: z.string().trim().optional().default(""),
  phone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, "Numéro de téléphone invalide."),
});

const feeEstimateSchema = z
  .object({
    items: z
      .array(z.object({ key: z.string(), amount: z.number() }))
      .default([]),
    total: z.number().default(0),
  })
  .default({ items: [], total: 0 });

export const visaSchema = z
  .object({
    applicant: applicantSchema,
    visa_type: z.enum(VISA_TYPES, {
      required_error: "Sélectionnez un type de visa.",
    }),
    company_id: z.string().optional().nullable().default(null),
    branch: branchSchema,
    documents: z.array(visaDocumentSchema).default([]),
    medical_appointment: appointmentSchema,
    biometric_appointment: appointmentSchema,
    emirates_id_address: addressSchema,
    payment_estimate: feeEstimateSchema,
  })
  .superRefine((data, ctx) => {
    const b = data.branch;
    const fail = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

    switch (data.visa_type) {
      case "investor":
        if (!data.company_id) {
          fail(["company_id"], "Sélectionnez la société liée.");
        }
        if (!b.role_societe) {
          fail(["branch", "role_societe"], "Précisez le rôle dans la société.");
        }
        if (b.pourcentage_participation == null) {
          fail(
            ["branch", "pourcentage_participation"],
            "Indiquez le pourcentage de participation."
          );
        }
        break;
      case "employee":
        if (!data.company_id) {
          fail(["company_id"], "Sélectionnez la société employeur.");
        }
        if (!b.poste) {
          fail(["branch", "poste"], "Précisez le poste occupé.");
        }
        if (b.salaire_mensuel == null) {
          fail(["branch", "salaire_mensuel"], "Indiquez le salaire mensuel.");
        }
        if (!b.type_contrat) {
          fail(["branch", "type_contrat"], "Sélectionnez un type de contrat.");
        }
        break;
      case "golden":
        if (!b.golden_categorie) {
          fail(
            ["branch", "golden_categorie"],
            "Sélectionnez une catégorie Golden Visa."
          );
        }
        if (!b.golden_duree) {
          fail(["branch", "golden_duree"], "Sélectionnez une durée.");
        }
        if (!b.golden_justificatif) {
          fail(
            ["branch", "golden_justificatif"],
            "Décrivez le justificatif d'éligibilité."
          );
        }
        break;
      case "family":
        if (!b.family_lien_sponsor) {
          fail(
            ["branch", "family_lien_sponsor"],
            "Sélectionnez le lien de parenté du sponsor."
          );
        }
        if (!b.sponsor_nom) {
          fail(["branch", "sponsor_nom"], "Indiquez le nom du sponsor.");
        }
        if (!b.sponsor_prenom) {
          fail(["branch", "sponsor_prenom"], "Indiquez le prénom du sponsor.");
        }
        if (!b.sponsor_id_numero) {
          fail(
            ["branch", "sponsor_id_numero"],
            "Indiquez le numéro Emirates ID ou de visa du sponsor."
          );
        }
        break;
      case "domestic":
        if (!b.domestic_poste) {
          fail(["branch", "domestic_poste"], "Sélectionnez le type de poste.");
        }
        if (!b.domestic_sponsor_nom) {
          fail(
            ["branch", "domestic_sponsor_nom"],
            "Indiquez le nom du sponsor."
          );
        }
        if (!b.domestic_foyer_adresse) {
          fail(
            ["branch", "domestic_foyer_adresse"],
            "Indiquez l'adresse du foyer."
          );
        }
        break;
      case "remote":
        if (!b.remote_employeur_nom) {
          fail(
            ["branch", "remote_employeur_nom"],
            "Indiquez le nom de l'employeur à l'étranger."
          );
        }
        if (!b.remote_employeur_pays) {
          fail(
            ["branch", "remote_employeur_pays"],
            "Indiquez le pays de l'employeur."
          );
        }
        if (b.remote_revenu_minimum == null) {
          fail(
            ["branch", "remote_revenu_minimum"],
            "Indiquez le revenu mensuel minimum déclaré."
          );
        }
        if (!b.remote_preuve_emploi) {
          fail(
            ["branch", "remote_preuve_emploi"],
            "Décrivez la preuve d'emploi."
          );
        }
        break;
    }
  });

export type VisaFormValues = z.infer<typeof visaSchema>;
