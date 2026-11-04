"use server";

import { revalidatePath } from "next/cache";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "@/lib/supabaseClient";
import type { ActionResult } from "@/lib/types";
import {
  generateDevReference,
  validateDevRequest,
  validateDevStatusChange,
  type DevRequest,
  type DevStatus,
} from "@/lib/dev-request";

const TABLE = "dev_request";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

export async function listDevRequests(): Promise<ActionResult<DevRequest[]>> {
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as DevRequest[] };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}

/** A MAO user asks the development team for a change, a new feature or a fix. */
export async function createDevRequest(input: {
  kind: string;
  priority: string;
  title: string;
  description: string;
  requester_name?: string | null;
  requester_email?: string | null;
}): Promise<ActionResult<DevRequest>> {
  const issues = validateDevRequest(input);
  if (issues.length > 0) {
    return { success: false, error: issues[0], issues: issues.map((code) => ({ code })) };
  }
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .insert({
        reference: generateDevReference(),
        kind: input.kind,
        priority: input.priority,
        title: input.title.trim(),
        description: input.description.trim(),
        requester_name: input.requester_name?.trim() || null,
        requester_email: input.requester_email?.trim() || null,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/support");
    return { success: true, data: data as DevRequest };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}

/** Follow-up of a request (demo: done from the app; a declined one needs a reason). */
export async function updateDevRequestStatus(
  id: string,
  status: DevStatus,
  comment: string
): Promise<ActionResult<DevRequest>> {
  const issues = validateDevStatusChange(status, comment);
  if (issues.length > 0) {
    return { success: false, error: issues[0], issues: issues.map((code) => ({ code })) };
  }
  if (!isSupabaseConfigured()) return { success: false, error: new SupabaseConfigError().message };
  try {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .update({
        status,
        dev_comment: comment.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/support");
    return { success: true, data: data as DevRequest };
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}
