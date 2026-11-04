import { z } from "zod";

const PHONE_REGEX = /^[+0-9][0-9 ().-]{5,20}$/;

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const personInputSchema = z.object({
  first_name: z.string().trim().min(2, "Le prénom doit contenir au moins 2 caractères."),
  last_name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères."),
  email: z
    .string()
    .trim()
    .email("Adresse e-mail invalide.")
    .or(z.literal(""))
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  phone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, "Numéro de téléphone invalide.")
    .or(z.literal(""))
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  nationality: optionalText,
  passport_number: optionalText,
  birth_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date de naissance invalide.")
    .or(z.literal(""))
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const parentCompanyInputSchema = z.object({
  name: z.string().trim().min(2, "Le nom de la société mère est requis."),
  country: optionalText,
  registration_number: optionalText,
});

export const holderInputSchema = z
  .object({
    /** Existing shareholder id (kept, with its KYC and documents). */
    id: z.string().uuid().optional().nullable(),
    kind: z.enum(["PERSON", "PARENT_COMPANY"]),
    share_pct: z.number().gt(0, "Une part doit être supérieure à 0.").max(100),
    is_manager: z.boolean(),
    person: personInputSchema.optional().nullable(),
    parent_company: parentCompanyInputSchema.optional().nullable(),
  })
  .superRefine((h, ctx) => {
    if (h.kind === "PERSON" && !h.person) {
      ctx.addIssue({ code: "custom", message: "Identité de l'associé manquante." });
    }
    if (h.kind === "PARENT_COMPANY" && !h.parent_company) {
      ctx.addIssue({ code: "custom", message: "Société mère manquante." });
    }
    if (h.kind === "PARENT_COMPANY" && h.is_manager) {
      ctx.addIssue({ code: "custom", message: "Le dirigeant doit être une personne physique." });
    }
  });

export const holdersInputSchema = z.array(holderInputSchema).min(1, "Ajoutez au moins un associé.");

export type HolderInput = z.infer<typeof holderInputSchema>;
export type PersonInput = z.infer<typeof personInputSchema>;

export const officeInputSchema = z.object({
  office_type_id: z.string().uuid(),
  visa_quota: z.number().int().min(0),
  accounting: z.boolean(),
});
