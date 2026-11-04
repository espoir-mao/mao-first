"use server";

import { revalidatePath } from "next/cache";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "@/lib/supabaseClient";
import type { ActionResult } from "@/lib/types";
import type { VisaApplication } from "@/lib/visa-types";
import { visaSchema } from "@/lib/visa-schema";
import { VISA_DOCUMENTS_BUCKET } from "@/lib/storage";
import {
  computeVisaExpiry,
  generateTrackingReference,
  getVisaFeeLines,
  getVisaFeeTotal,
} from "@/lib/visa-constants";
import type { VisaType } from "@/lib/visa-constants";
import type { VisaFormValues } from "@/lib/visa-schema";

const TABLE = "visa_application";

export async function listVisaApplications(): Promise<
  ActionResult<VisaApplication[]>
> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as VisaApplication[] };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function getVisaApplication(
  id: string
): Promise<ActionResult<VisaApplication>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as VisaApplication };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export type VisaPayload = VisaFormValues;

function buildRow(payload: VisaPayload) {
  const parsed = visaSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Formulaire invalide.";
    return { error: message } as const;
  }

  const data = parsed.data;
  const feeLines = getVisaFeeLines(data.visa_type);
  const feeTotal = getVisaFeeTotal(data.visa_type);

  return {
    row: {
      visa_type: data.visa_type,
      applicant: data.applicant,
      company_id:
        data.visa_type === "investor" || data.visa_type === "employee"
          ? data.company_id ?? null
          : null,
      branch_data: data.branch,
      documents: data.documents,
      medical_appointment: data.medical_appointment,
      biometric_appointment: data.biometric_appointment,
      emirates_id_address: data.emirates_id_address,
      payment_estimate: { items: feeLines, total: feeTotal },
    },
  } as const;
}

export async function createVisaApplication(
  payload: VisaPayload
): Promise<ActionResult<VisaApplication>> {
  const built = buildRow(payload);
  if ("error" in built) {
    return { success: false, error: built.error };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        ...built.row,
        status: "soumis",
        tracking_reference: generateTrackingReference(),
        decision_status: "en_attente",
        decided_at: null,
        expires_at: null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/administration/visas");
    return { success: true, data: data as VisaApplication };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function updateVisaApplication(
  id: string,
  payload: VisaPayload
): Promise<ActionResult<VisaApplication>> {
  const built = buildRow(payload);
  if ("error" in built) {
    return { success: false, error: built.error };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  try {
    const supabase = getSupabaseClient();

    // Keep the existing tracking reference (set on first submission); only
    // generate a new one in the rare case it was somehow never set.
    const { data: existing } = await supabase
      .from(TABLE)
      .select("tracking_reference")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        ...built.row,
        status: "soumis",
        tracking_reference:
          existing?.tracking_reference ?? generateTrackingReference(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/administration/visas");
    return { success: true, data: data as VisaApplication };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function deleteVisaApplication(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  try {
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from(TABLE)
      .select("documents")
      .eq("id", id)
      .single();

    const { error } = await supabase.from(TABLE).delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    const documents = (existing?.documents ?? []) as { path: string }[];
    if (documents.length > 0) {
      try {
        await supabase.storage
          .from(VISA_DOCUMENTS_BUCKET)
          .remove(documents.map((d) => d.path));
      } catch (storageErr) {
        console.error(
          "Impossible de supprimer les documents associés dans Supabase Storage:",
          storageErr
        );
      }
    }

    revalidatePath("/administration/visas");
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export interface AppointmentNotifyResult {
  notified_at: string;
  mock_id: string;
}

/**
 * Mock "send preference" notification for an appointment (medical or
 * biometric). This does NOT send any real email/SMS and does NOT book or
 * confirm an actual appointment — it only simulates a short network delay
 * and returns a fake notification id + timestamp, which the caller uses to
 * flip that appointment's status badge client-side. Logged server-side only
 * for traceability of the mock action; nothing is persisted here (the full
 * form, including the appointment status, is only saved to Supabase when
 * the wizard is actually submitted).
 */
export async function sendVisaAppointmentPreference(
  kind: "medical" | "biometric"
): Promise<ActionResult<AppointmentNotifyResult>> {
  // Simulate network/latency of a real notification dispatch.
  await new Promise((resolve) => setTimeout(resolve, 600));

  const mock_id = `MOCKNOTIF-${Date.now().toString(36).toUpperCase()}`;
  console.log(
    `[mock notification] ${kind} appointment preference "sent" (id: ${mock_id}). ` +
      "No real email/SMS was dispatched and no real appointment was booked."
  );

  return {
    success: true,
    data: { notified_at: new Date().toISOString(), mock_id },
  };
}

/**
 * DEMO-ONLY SIMULATION of the final decision on a visa request (granted or
 * rejected). This app has no separate backend/admin interface, so this
 * action stands in for what would normally be an official decision by the
 * relevant authority — it is never a real government/authority integration.
 * When granted, also computes a plausible validity end date (see
 * computeVisaExpiry in lib/visa-constants.ts). Shown on the "/administration/visas" page.
 */
export async function simulateVisaDecision(
  id: string,
  decision: "obtenu" | "rejete"
): Promise<ActionResult<VisaApplication>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  try {
    const supabase = getSupabaseClient();
    const { data: existing, error: fetchError } = await supabase
      .from(TABLE)
      .select("visa_type")
      .eq("id", id)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const decidedAt = new Date();
    const decidedAtIso = decidedAt.toISOString();
    const expiresAt =
      decision === "obtenu"
        ? computeVisaExpiry(existing.visa_type as VisaType, decidedAt)
        : null;

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        decision_status: decision,
        decided_at: decidedAtIso,
        expires_at: expiresAt,
        updated_at: decidedAtIso,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/administration/visas");
    revalidatePath("/");
    return { success: true, data: data as VisaApplication };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Une erreur inattendue est survenue.";
}
