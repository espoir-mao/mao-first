"use server";

import { revalidatePath } from "next/cache";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "@/lib/supabaseClient";
import type { ActionResult } from "@/lib/types";
import {
  generateCorrectionReference,
  validateAnswer,
  validateClose,
  validateRaise,
  validateWaiver,
  type CorrectionFile,
  type CorrectionRequest,
} from "@/lib/correction";

const TABLE = "company_correction_request";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/administration", "layout");
  revalidatePath("/societes", "layout");
  revalidatePath("/backoffice", "layout");
}

/** Corrections of a company file and/or one visa application, newest first. */
export async function listCorrections(filter: {
  companyId?: string;
  visaId?: string;
  /** Companies only (visa_application_id is null). */
  companyLevelOnly?: boolean;
}): Promise<ActionResult<CorrectionRequest[]>> {
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    let q = getSupabaseClient().from(TABLE).select("*").order("created_at", { ascending: false });
    if (filter.companyId) q = q.eq("company_id", filter.companyId);
    if (filter.visaId) q = q.eq("visa_application_id", filter.visaId);
    if (filter.companyLevelOnly) q = q.is("visa_application_id", null);
    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as CorrectionRequest[] };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}

/** Every correction (badges, backoffice overview). */
export async function listAllCorrections(): Promise<ActionResult<CorrectionRequest[]>> {
  return listCorrections({});
}

/** Backoffice: raises a correction / additional request towards the company. */
export async function raiseCorrection(input: {
  companyId: string;
  visaId?: string | null;
  section: string;
  message: string;
  /** Raise it as non blocking, with its explanation. */
  nonBlockingReason?: string | null;
}): Promise<ActionResult<CorrectionRequest>> {
  const issues = validateRaise({
    nonBlockingReason: input.nonBlockingReason,
    section: input.section,
    message: input.message,
    isVisa: Boolean(input.visaId),
  });
  if (issues.length > 0) {
    return { success: false, error: issues[0], issues: issues.map((code) => ({ code })) };
  }
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .insert({
        reference: generateCorrectionReference(),
        company_id: input.companyId,
        visa_application_id: input.visaId ?? null,
        section: input.section,
        message: input.message.trim(),
        ...(input.nonBlockingReason
          ? { is_blocking: false, waiver_reason: input.nonBlockingReason.trim(), waived_at: new Date().toISOString() }
          : {}),
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    refresh();
    return { success: true, data: data as CorrectionRequest };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}

/** Company side: answers with a text and/or attachments (already uploaded to Storage). */
export async function answerCorrection(
  id: string,
  response: string,
  files: CorrectionFile[]
): Promise<ActionResult<CorrectionRequest>> {
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    const sb = getSupabaseClient();
    const cur = await sb.from(TABLE).select("status").eq("id", id).single();
    if (cur.error) return { success: false, error: cur.error.message };
    const issues = validateAnswer({ status: cur.data.status }, response, files);
    if (issues.length > 0) {
      return { success: false, error: issues[0], issues: issues.map((code) => ({ code })) };
    }
    const { data, error } = await sb
      .from(TABLE)
      .update({
        status: "REPONDU",
        response: response.trim() || null,
        response_files: files,
        answered_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "OUVERT")
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    refresh();
    return { success: true, data: data as CorrectionRequest };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}

/** Backoffice: the correction is satisfactory (or withdrawn) — closes it. */
export async function closeCorrection(id: string): Promise<ActionResult<CorrectionRequest>> {
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    const sb = getSupabaseClient();
    const cur = await sb.from(TABLE).select("status").eq("id", id).single();
    if (cur.error) return { success: false, error: cur.error.message };
    const issues = validateClose({ status: cur.data.status });
    if (issues.length > 0) {
      return { success: false, error: issues[0], issues: issues.map((code) => ({ code })) };
    }
    const { data, error } = await sb
      .from(TABLE)
      .update({ status: "CLOTURE", closed_at: new Date().toISOString() })
      .eq("id", id)
      .neq("status", "CLOTURE")
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    refresh();
    return { success: true, data: data as CorrectionRequest };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}

/** Backoffice: waives a pending request (dérogation): it stops blocking, with an explanation. */
export async function waiveCorrection(id: string, reason: string): Promise<ActionResult<CorrectionRequest>> {
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    const sb = getSupabaseClient();
    const cur = await sb.from(TABLE).select("status, is_blocking").eq("id", id).single();
    if (cur.error) return { success: false, error: cur.error.message };
    const issues = validateWaiver(cur.data, reason);
    if (issues.length > 0) {
      return { success: false, error: issues[0], issues: issues.map((code) => ({ code })) };
    }
    const { data, error } = await sb
      .from(TABLE)
      .update({ is_blocking: false, waiver_reason: reason.trim(), waived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("is_blocking", true)
      .neq("status", "CLOTURE")
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    refresh();
    return { success: true, data: data as CorrectionRequest };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}
