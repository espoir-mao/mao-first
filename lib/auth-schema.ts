import { z } from "zod";

/**
 * Zod schemas for the login / sign-up forms. Kept separate from
 * `lib/schema.ts` (the société form's schema) since that file is owned by
 * a different part of the app.
 *
 * Messages are translation keys (from `lib/i18n.ts`'s `auth.validation.*`
 * / `auth.field.*` namespace) rather than literal strings, so the forms can
 * simply call `t(errors.field?.message)` to render them in the active
 * language.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "auth.validation.required")
    .email("auth.validation.email"),
  password: z
    .string()
    .min(1, "auth.validation.required")
    .min(6, "auth.validation.password.min"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "auth.validation.required"),
    lastName: z.string().trim().min(1, "auth.validation.required"),
    email: z
      .string()
      .trim()
      .min(1, "auth.validation.required")
      .email("auth.validation.email"),
    password: z
      .string()
      .min(1, "auth.validation.required")
      .min(6, "auth.validation.password.min"),
    confirmPassword: z.string().min(1, "auth.validation.required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "auth.validation.password.mismatch",
    path: ["confirmPassword"],
  });

export type SignupFormValues = z.infer<typeof signupSchema>;
