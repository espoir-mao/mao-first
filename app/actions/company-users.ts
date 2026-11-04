"use server";

import { revalidatePath } from "next/cache";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "@/lib/supabaseClient";
import {
  PERMISSION_SECTIONS,
  type ActionResult,
  type CompanyUser,
  type CompanyUserPermissions,
} from "@/lib/types";

const TABLE = "company_user";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fills in every section and coerces to booleans, whatever was stored/sent. */
function normalizePermissions(input: unknown): CompanyUserPermissions {
  const source = (input ?? {}) as Record<string, { read?: unknown; write?: unknown }>;
  const out = {} as CompanyUserPermissions;
  for (const section of PERMISSION_SECTIONS) {
    out[section] = {
      read: Boolean(source[section]?.read),
      write: Boolean(source[section]?.write),
    };
  }
  return out;
}

function hasAnyRight(p: CompanyUserPermissions): boolean {
  return PERMISSION_SECTIONS.some((s) => p[s].read || p[s].write);
}

function normalizeRow(row: CompanyUser): CompanyUser {
  return { ...row, permissions: normalizePermissions(row.permissions) };
}

export async function listCompanyUsers(
  companyId: string
): Promise<ActionResult<CompanyUser[]>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: ((data ?? []) as CompanyUser[]).map(normalizeRow) };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export interface AddCompanyUserInput {
  name: string;
  email: string;
  permissions: CompanyUserPermissions;
}

export async function addCompanyUser(
  companyId: string,
  input: AddCompanyUserInput
): Promise<ActionResult<CompanyUser>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const permissions = normalizePermissions(input.permissions);

  if (name.length < 2) {
    return { success: false, error: "Le nom doit contenir au moins 2 caractères." };
  }
  if (!EMAIL_RE.test(email)) {
    return { success: false, error: "Adresse e-mail invalide." };
  }
  if (!hasAnyRight(permissions)) {
    return { success: false, error: "Accordez au moins un droit (lecture ou écriture)." };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ company_id: companyId, name, email, permissions })
      .select()
      .single();
    if (error) {
      // 23505 = unique_violation on (company_id, email)
      if ((error as { code?: string }).code === "23505") {
        return { success: false, error: "Cet utilisateur existe déjà pour cette société." };
      }
      return { success: false, error: error.message };
    }
    revalidatePath("/administration/utilisateurs");
    return { success: true, data: normalizeRow(data as CompanyUser) };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function updateCompanyUserPermissions(
  id: string,
  companyId: string,
  permissions: CompanyUserPermissions
): Promise<ActionResult<CompanyUser>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  const normalized = normalizePermissions(permissions);
  if (!hasAnyRight(normalized)) {
    return {
      success: false,
      error: "Un utilisateur doit garder au moins un droit ; supprimez-le sinon.",
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .update({ permissions: normalized })
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/administration/utilisateurs");
    return { success: true, data: normalizeRow(data as CompanyUser) };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function removeCompanyUser(
  id: string,
  companyId: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/administration/utilisateurs");
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Une erreur inattendue est survenue.";
}
