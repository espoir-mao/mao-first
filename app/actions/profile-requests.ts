"use server";

import { revalidatePath } from "next/cache";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "@/lib/supabaseClient";
import type { ActionResult } from "@/lib/types";
import {
  buildProfileRequest,
  generateProfileRequestReference,
  type ProfileChangeRequest,
  type ProfileValues,
} from "@/lib/profile-request";

const TABLE = "profile_change_request";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

/** Requests of one person, newest first (profile page). */
export async function listMyProfileRequests(
  userId: string
): Promise<ActionResult<ProfileChangeRequest[]>> {
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ProfileChangeRequest[] };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}

/** Every request, newest first (Backoffice MAO). */
export async function listProfileChangeRequests(): Promise<ActionResult<ProfileChangeRequest[]>> {
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ProfileChangeRequest[] };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}

export interface ProfileRequestInput {
  user_id: string;
  user_email: string | null;
  company_id?: string | null;
  company_name?: string | null;
  /** What the person currently sees (the diff is computed against it). */
  current: ProfileValues;
  wanted: ProfileValues;
  reason?: string;
}

/** Submits a request; nothing changes until MAO approves it. */
export async function createProfileChangeRequest(
  input: ProfileRequestInput
): Promise<ActionResult<ProfileChangeRequest>> {
  const { values, issues } = buildProfileRequest(input.current, input.wanted);
  if (issues.length > 0) {
    return { success: false, error: issues[0], issues: issues.map((code) => ({ code })) };
  }
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };

  try {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .insert({
        reference: generateProfileRequestReference(),
        user_id: input.user_id,
        user_email: input.user_email,
        company_id: input.company_id ?? null,
        company_name: input.company_name ?? null,
        current_values: input.current,
        requested_values: values,
        reason: input.reason?.trim() || null,
      })
      .select()
      .single();
    if (error) {
      // unique index: one open request per person
      if (error.code === "23505") {
        return { success: false, error: "ALREADY_OPEN", issues: [{ code: "ALREADY_OPEN" }] };
      }
      return { success: false, error: error.message };
    }
    revalidatePath("/profil");
    revalidatePath("/backoffice/profils");
    return { success: true, data: data as ProfileChangeRequest };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}

/** Backoffice decision. A refusal needs a comment (also a DB CHECK). */
export async function decideProfileChangeRequest(
  id: string,
  approve: boolean,
  comment?: string
): Promise<ActionResult<ProfileChangeRequest>> {
  const note = comment?.trim() ?? "";
  if (!approve && note.length < 3) {
    return { success: false, error: "COMMENT_REQUIRED", issues: [{ code: "COMMENT_REQUIRED" }] };
  }
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .update({
        status: approve ? "approuve" : "refuse",
        decided_at: new Date().toISOString(),
        decision_comment: note || null,
      })
      .eq("id", id)
      .eq("status", "ouvert")
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/profil");
    revalidatePath("/backoffice/profils");
    return { success: true, data: data as ProfileChangeRequest };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}
