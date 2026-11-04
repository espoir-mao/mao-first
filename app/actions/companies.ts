"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "@/lib/supabaseClient";
import type { ActionResult } from "@/lib/types";
import type {
  Authority,
  ClientChoice,
  Company,
  CompanyCatalog,
  CompanyFile,
  CompanyLicenceHistoryEntry,
  CompanyNameRequest,
  CompanyPayment,
  CompanyRenewalTicket,
  JurisdictionType,
  LeaseMode,
  Shareholder,
} from "@/lib/company-types";
import {
  canTransition,
  computeLicenceExpiry,
  documentChecklist,
  generateLicenceNumber,
  generatePaymentReference,
  generateTrackingReference,
  nameApprovalIssues,
  resolveLegalForm,
  resolveLicenceType,
  selectableActivities,
  selectableAuthorities,
  submissionIssues,
  validateNameProposals,
  validateTradeName,
  validateOffice,
  validateShareholders,
  type SubmissionSnapshot,
} from "@/lib/company-domain";
import {
  holderInputSchema,
  holdersInputSchema,
  officeInputSchema,
  type HolderInput,
} from "@/lib/company-schema";
import {
  markLicenseRenewalTicketProcessed,
  recordLicenseRenewalTicket,
} from "@/app/actions/support";
import { generateLicenseTicketReference } from "@/lib/societe-constants";

/* -------------------------------------------------------------- plumbing */

type Sb = SupabaseClient;

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Une erreur inattendue est survenue.";
}

/** Runs `fn` with the client; turns thrown errors / missing config into a result. */
async function withDb<T>(
  fn: (sb: Sb) => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }
  try {
    return await fn(getSupabaseClient());
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/societes");
  revalidatePath("/a-propos");
  revalidatePath("/licence");
  revalidatePath("/backoffice/societes");
  revalidatePath("/backoffice/licences");
}

/* ------------------------------------------------------------- catalogue */

export async function getCompanyCatalog(): Promise<ActionResult<CompanyCatalog>> {
  return withDb(async (sb) => {
    const q = async <T,>(table: string, order?: string) => {
      let query = sb.from(table).select("*");
      if (order) query = query.order(order);
      const { data, error } = await query;
      if (error) throw new Error(`${table}: ${error.message}`);
      return (data ?? []) as T[];
    };
    const [
      authorities,
      legalForms,
      authorityLegalForms,
      licenceTypes,
      activities,
      officeTypes,
      officeOptions,
      pricing,
      requiredDocuments,
      maoFees,
    ] = await Promise.all([
      q<CompanyCatalog["authorities"][number]>("authority", "name"),
      q<CompanyCatalog["legalForms"][number]>("legal_form", "label"),
      q<CompanyCatalog["authorityLegalForms"][number]>("authority_legal_form"),
      q<CompanyCatalog["licenceTypes"][number]>("licence_type", "label"),
      q<CompanyCatalog["activities"][number]>("activity", "label"),
      q<CompanyCatalog["officeTypes"][number]>("office_type", "label"),
      q<CompanyCatalog["officeOptions"][number]>("authority_office_option"),
      q<CompanyCatalog["pricing"][number]>("authority_pricing"),
      q<CompanyCatalog["requiredDocuments"][number]>("required_document"),
      q<CompanyCatalog["maoFees"][number]>("mao_fee"),
    ]);
    return {
      success: true,
      data: {
        authorities,
        legalForms,
        authorityLegalForms,
        licenceTypes,
        activities,
        officeTypes,
        officeOptions,
        pricing,
        requiredDocuments,
        maoFees,
      },
    };
  });
}

/* ----------------------------------------------------------------- reads */

async function hydrate(sb: Sb, rows: Company[]): Promise<CompanyFile[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [auth, lfs, lts, ots, names, holders, acts, docs, pays] = await Promise.all([
    sb.from("authority").select("*"),
    sb.from("legal_form").select("*"),
    sb.from("licence_type").select("*"),
    sb.from("office_type").select("*"),
    sb.from("company_name_request").select("*").in("company_id", ids).order("rank"),
    sb
      .from("shareholder")
      .select("*, person(*), parent_company(*)")
      .in("company_id", ids)
      .order("share_pct", { ascending: false }),
    sb.from("company_activity").select("*").in("company_id", ids),
    sb.from("company_document").select("*").in("company_id", ids),
    sb.from("company_payment").select("*").in("company_id", ids),
  ]);
  for (const r of [auth, lfs, lts, ots, names, holders, acts, docs, pays]) {
    if (r.error) throw new Error(r.error.message);
  }
  const byId = <T extends { id: string }>(list: unknown) =>
    new Map<string, T>(((list ?? []) as T[]).map((x) => [x.id, x]));
  const A = byId<Authority>(auth.data);
  const L = byId<NonNullable<CompanyFile["legal_form"]>>(lfs.data);
  const T = byId<NonNullable<CompanyFile["licence_type"]>>(lts.data);
  const O = byId<NonNullable<CompanyFile["office_type"]>>(ots.data);
  const group = <K extends string>(list: unknown, key: K) => {
    const m = new Map<string, any[]>();
    ((list ?? []) as any[]).forEach((x) => {
      const arr = m.get(x[key]) ?? [];
      arr.push(x);
      m.set(x[key], arr);
    });
    return m;
  };
  const gNames = group(names.data, "company_id");
  const gHolders = group(holders.data, "company_id");
  const gActs = group(acts.data, "company_id");
  const gDocs = group(docs.data, "company_id");
  const gPays = group(pays.data, "company_id");

  return rows.map((c) => ({
    ...c,
    authority: c.authority_id ? A.get(c.authority_id) ?? null : null,
    legal_form: c.legal_form_id ? L.get(c.legal_form_id) ?? null : null,
    licence_type: c.licence_type_id ? T.get(c.licence_type_id) ?? null : null,
    office_type: c.office_type_id ? O.get(c.office_type_id) ?? null : null,
    activity_ids: (gActs.get(c.id) ?? []).map((a) => a.activity_id as string),
    names: (gNames.get(c.id) ?? []) as CompanyNameRequest[],
    shareholders: (gHolders.get(c.id) ?? []) as Shareholder[],
    documents: gDocs.get(c.id) ?? [],
    payment: ((gPays.get(c.id) ?? [])[0] ?? null) as CompanyPayment | null,
  }));
}

export async function listCompanies(): Promise<ActionResult<CompanyFile[]>> {
  return withDb(async (sb) => {
    const { data, error } = await sb
      .from("company")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: await hydrate(sb, (data ?? []) as Company[]) };
  });
}

export async function getCompany(id: string): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    const { data, error } = await sb.from("company").select("*").eq("id", id).single();
    if (error) return { success: false, error: error.message };
    const [file] = await hydrate(sb, [data as Company]);
    return { success: true, data: file };
  });
}

/** Loads a company and the catalogue needed to validate a step. */
async function load(sb: Sb, id: string) {
  const [{ data, error }, catalog] = await Promise.all([
    sb.from("company").select("*").eq("id", id).single(),
    getCompanyCatalog(),
  ]);
  if (error) throw new Error(error.message);
  if (!catalog.success || !catalog.data) throw new Error(catalog.error);
  const [file] = await hydrate(sb, [data as Company]);
  return { file, catalog: catalog.data };
}

function requireDraft(file: CompanyFile): string | null {
  return file.status === "DRAFT" ? null : "Ce dossier a déjà été soumis : il n'est plus modifiable.";
}

async function reload(sb: Sb, id: string): Promise<ActionResult<CompanyFile>> {
  const { data, error } = await sb.from("company").select("*").eq("id", id).single();
  if (error) return { success: false, error: error.message };
  const [file] = await hydrate(sb, [data as Company]);
  revalidateAll();
  return { success: true, data: file };
}

/* ----------------------------------------------- wizard: one action / step */

/** Steps 1: creates the draft with the chosen jurisdiction. */
export async function createCompanyDraft(input: {
  jurisdiction: JurisdictionType;
  requesterName?: string;
}): Promise<ActionResult<CompanyFile>> {
  if (input.jurisdiction !== "MAINLAND" && input.jurisdiction !== "FREE_ZONE") {
    return { success: false, error: "Régime invalide." };
  }
  return withDb(async (sb) => {
    const { data, error } = await sb
      .from("company")
      .insert({
        jurisdiction_type: input.jurisdiction,
        requester_name: input.requesterName?.trim() || null,
      })
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return reload(sb, data.id as string);
  });
}

/** Steps 1-3: jurisdiction + authority + structure (legal form resolved here). */
export async function saveCompanyStructure(
  id: string,
  input: {
    jurisdiction: JurisdictionType;
    authorityId: string;
    clientChoice: ClientChoice | null;
  },
  draft = false
): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    const { file, catalog } = await load(sb, id);
    const notDraft = requireDraft(file);
    if (notDraft) return { success: false, error: notDraft };

    if (draft && (!input.authorityId || !input.clientChoice)) {
      // partial save: keep what is known, the rest is filled in later
      const known = selectableAuthorities(catalog.authorities, input.jurisdiction).find(
        (a) => a.id === input.authorityId
      );
      const changed = (known?.id ?? null) !== file.authority_id;
      if (changed && file.activity_ids.length > 0) {
        const del = await sb.from("company_activity").delete().eq("company_id", id);
        if (del.error) return { success: false, error: del.error.message };
      }
      const upd = await sb
        .from("company")
        .update({
          jurisdiction_type: input.jurisdiction,
          authority_id: known?.id ?? null,
          ...(changed || !input.clientChoice
            ? { client_choice: input.clientChoice, legal_form_id: null }
            : {}),
          ...(changed ? { licence_type_id: null, office_type_id: null, visa_quota: null } : {}),
        })
        .eq("id", id);
      if (upd.error) return { success: false, error: upd.error.message };
      return reload(sb, id);
    }
    if (!input.clientChoice) return { success: false, error: "STEP_STRUCTURE" };

    const authority = selectableAuthorities(catalog.authorities, input.jurisdiction).find(
      (a) => a.id === input.authorityId
    );
    if (!authority) {
      return { success: false, error: "Ce guichet n'est pas disponible pour ce régime." };
    }
    if (input.clientChoice === "FREELANCE" && !authority.allows_freelance) {
      return { success: false, error: "Ce guichet ne propose pas le statut freelance." };
    }
    const legalForm = resolveLegalForm(
      authority.id,
      input.clientChoice,
      catalog.authorityLegalForms,
      catalog.legalForms
    );
    if (!legalForm || !legalForm.in_mao_flow) {
      return { success: false, error: "Cette structure n'est pas proposée par ce guichet." };
    }

    const changedAuthority = file.authority_id !== authority.id;
    if (changedAuthority && file.activity_ids.length > 0) {
      // activities belong to one authority: they are reset with it
      const del = await sb.from("company_activity").delete().eq("company_id", id);
      if (del.error) return { success: false, error: del.error.message };
    }
    const { error } = await sb
      .from("company")
      .update({
        jurisdiction_type: input.jurisdiction,
        authority_id: authority.id,
        client_choice: input.clientChoice,
        legal_form_id: legalForm.id,
        ...(changedAuthority
          ? { licence_type_id: null, office_type_id: null, visa_quota: null }
          : {}),
      })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return reload(sb, id);
  });
}

/** Step 4: activities (the licence type follows). */
export async function saveCompanyActivities(
  id: string,
  activityIds: string[],
  draft = false
): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    const { file, catalog } = await load(sb, id);
    const notDraft = requireDraft(file);
    if (notDraft) return { success: false, error: notDraft };
    if (!file.authority_id) return { success: false, error: "Choisissez d'abord le guichet." };

    const unique = Array.from(new Set(activityIds));
    const res = resolveLicenceType(unique, catalog.activities, file.authority_id, catalog.licenceTypes);
    if (draft && (res.issues.length > 0 || !res.licenceTypeId)) {
      // incomplete choice: keep the ticked activities that belong to the authority
      const allowed = unique.filter((x) =>
        selectableActivities(catalog.activities, file.authority_id as string).some((c) => c.id === x)
      );
      const d1 = await sb.from("company_activity").delete().eq("company_id", id);
      if (d1.error) return { success: false, error: d1.error.message };
      const u1 = await sb.from("company").update({ licence_type_id: null }).eq("id", id);
      if (u1.error) return { success: false, error: u1.error.message };
      if (allowed.length > 0) {
        const i1 = await sb
          .from("company_activity")
          .insert(allowed.map((activity_id) => ({ company_id: id, activity_id })));
        if (i1.error) return { success: false, error: i1.error.message };
      }
      return reload(sb, id);
    }
    if (res.issues.length > 0 || !res.licenceTypeId) {
      return { success: false, error: res.issues[0]?.code ?? "ACTIVITY_REQUIRED", issues: res.issues };
    }

    const del = await sb.from("company_activity").delete().eq("company_id", id);
    if (del.error) return { success: false, error: del.error.message };
    const upd = await sb.from("company").update({ licence_type_id: res.licenceTypeId }).eq("id", id);
    if (upd.error) return { success: false, error: upd.error.message };
    const ins = await sb
      .from("company_activity")
      .insert(unique.map((activity_id) => ({ company_id: id, activity_id })));
    if (ins.error) return { success: false, error: ins.error.message };
    return reload(sb, id);
  });
}

/** Step 5: the three ranked trade-name proposals. */
export async function saveCompanyNames(
  id: string,
  names: string[],
  draft = false
): Promise<ActionResult<CompanyFile>> {
  let cleaned = names.map((n) => n.trim().replace(/\s+/g, " "));
  if (draft) {
    // keep only the proposals that are individually valid and not duplicated
    const kept: string[] = [];
    cleaned.forEach((n) => {
      if (
        n &&
        validateTradeName(n).length === 0 &&
        !kept.some((k) => k.toLowerCase() === n.toLowerCase())
      ) {
        kept.push(n);
      }
    });
    cleaned = kept;
  } else {
    const issues = validateNameProposals(cleaned);
    if (issues.length > 0) {
      return { success: false, error: issues[0].code, issues };
    }
  }
  return withDb(async (sb) => {
    const { file } = await load(sb, id);
    const notDraft = requireDraft(file);
    if (notDraft) return { success: false, error: notDraft };
    const del = await sb.from("company_name_request").delete().eq("company_id", id);
    if (del.error) return { success: false, error: del.error.message };
    if (cleaned.length === 0) return reload(sb, id);
    const ins = await sb.from("company_name_request").insert(
      cleaned.map((proposed_name, i) => ({ company_id: id, proposed_name, rank: i + 1 }))
    );
    if (ins.error) return { success: false, error: ins.error.message };
    return reload(sb, id);
  });
}

/** Step 6: office type, visa quota and the accounting option. */
export async function saveCompanyOffice(
  id: string,
  input: { office_type_id: string | null; visa_quota: number | null; accounting: boolean },
  draft = false
): Promise<ActionResult<CompanyFile>> {
  if (draft && (!input.office_type_id || input.visa_quota === null)) {
    return withDb(async (sb) => {
      const { file } = await load(sb, id);
      const notDraft = requireDraft(file);
      if (notDraft) return { success: false, error: notDraft };
      const { error } = await sb
        .from("company")
        .update({
          office_type_id: input.office_type_id || null,
          visa_quota: input.visa_quota,
          accounting: input.accounting,
        })
        .eq("id", id);
      if (error) return { success: false, error: error.message };
      return reload(sb, id);
    });
  }
  const parsed = officeInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Bureau invalide." };
  return withDb(async (sb) => {
    const { file, catalog } = await load(sb, id);
    const notDraft = requireDraft(file);
    if (notDraft) return { success: false, error: notDraft };
    if (!file.authority_id || !file.jurisdiction_type) {
      return { success: false, error: "Choisissez d'abord le guichet." };
    }
    const issues = validateOffice(
      file.jurisdiction_type,
      file.authority_id,
      parsed.data.office_type_id,
      parsed.data.visa_quota,
      catalog.officeOptions,
      catalog.officeTypes
    );
    if (issues.length > 0) return { success: false, error: issues[0].code, issues };
    const { error } = await sb
      .from("company")
      .update({
        office_type_id: parsed.data.office_type_id,
        visa_quota: parsed.data.visa_quota,
        accounting: parsed.data.accounting,
      })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return reload(sb, id);
  });
}

/** Step 7: shareholders and manager (existing ids keep their KYC / documents). */
export async function saveCompanyHolders(
  id: string,
  holders: HolderInput[],
  draft = false
): Promise<ActionResult<CompanyFile>> {
  // draft: incomplete rows are dropped, the 100% total is not required yet
  const source = draft
    ? holders.filter((h) => holderInputSchema.safeParse(h).success)
    : holders;
  if (draft) {
    const total = source.reduce((s, h) => s + Number(h.share_pct), 0);
    if (Math.round(total * 100) > 10000) return { success: false, error: "SHARES_OVER_100" };
  }
  const parsed = draft
    ? { success: true as const, data: source.map((h) => holderInputSchema.parse(h)) }
    : holdersInputSchema.safeParse(source);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Associés invalides." };
  }
  return withDb(async (sb) => {
    const { file, catalog } = await load(sb, id);
    const notDraft = requireDraft(file);
    if (notDraft) return { success: false, error: notDraft };
    if (!file.authority_id || !file.client_choice) {
      return { success: false, error: "Choisissez d'abord la structure." };
    }
    const lf = resolveLegalForm(
      file.authority_id,
      file.client_choice,
      catalog.authorityLegalForms,
      catalog.legalForms
    );
    if (!lf) return { success: false, error: "Structure inconnue." };
    if (!draft) {
      const issues = validateShareholders(
        file.client_choice,
        lf,
        parsed.data.map((h) => ({
          isPerson: h.kind === "PERSON",
          sharePct: h.share_pct,
          isManager: h.is_manager,
        }))
      );
      if (issues.length > 0) return { success: false, error: issues[0].code, issues };
    }

    const keepIds = parsed.data.map((h) => h.id).filter((x): x is string => Boolean(x));
    const existing = file.shareholders;
    // 1. remove the holders that are no longer listed (and their documents)
    const removed = existing.filter((s) => keepIds.indexOf(s.id) === -1);
    // The manager flag and the 100% total are checked row by row by the
    // database, so clear the flags and shares first, then write the new values.
    if (existing.length > 0) {
      const reset = await sb
        .from("shareholder")
        .update({ is_manager: false, share_pct: 0 })
        .eq("company_id", id);
      if (reset.error) return { success: false, error: reset.error.message };
    }
    if (removed.length > 0) {
      const del = await sb.from("shareholder").delete().in("id", removed.map((s) => s.id));
      if (del.error) return { success: false, error: del.error.message };
      const personIds = removed.map((s) => s.person_id).filter((x): x is string => Boolean(x));
      const parentIds = removed
        .map((s) => s.parent_company_id)
        .filter((x): x is string => Boolean(x));
      if (personIds.length) await sb.from("person").delete().in("id", personIds);
      if (parentIds.length) await sb.from("parent_company").delete().in("id", parentIds);
    }

    // 2. update / insert, non-managers first so the single-manager index holds
    const ordered = parsed.data
      .map((h, i) => ({ h, i }))
      .sort((a, b) => Number(a.h.is_manager) - Number(b.h.is_manager));
    for (const { h } of ordered) {
      const prev = h.id ? existing.find((s) => s.id === h.id) : undefined;
      let personId = prev?.person_id ?? null;
      let parentId = prev?.parent_company_id ?? null;
      let identityChanged = false;

      if (h.kind === "PERSON" && h.person) {
        if (personId) {
          const before = prev?.person;
          identityChanged =
            !before ||
            before.first_name !== h.person.first_name ||
            before.last_name !== h.person.last_name ||
            (before.passport_number ?? null) !== h.person.passport_number;
          const up = await sb.from("person").update(h.person).eq("id", personId);
          if (up.error) return { success: false, error: up.error.message };
        } else {
          const ins = await sb.from("person").insert(h.person).select("id").single();
          if (ins.error) return { success: false, error: ins.error.message };
          personId = ins.data.id as string;
        }
      }
      if (h.kind === "PARENT_COMPANY" && h.parent_company) {
        if (parentId) {
          const up = await sb.from("parent_company").update(h.parent_company).eq("id", parentId);
          if (up.error) return { success: false, error: up.error.message };
        } else {
          const ins = await sb.from("parent_company").insert(h.parent_company).select("id").single();
          if (ins.error) return { success: false, error: ins.error.message };
          parentId = ins.data.id as string;
        }
      }

      if (prev) {
        const up = await sb
          .from("shareholder")
          .update({
            share_pct: h.share_pct,
            is_manager: h.is_manager,
            ...(identityChanged
              ? { kyc_status: "NOT_STARTED", kyc_reference: null, kyc_checked_at: null }
              : {}),
          })
          .eq("id", prev.id);
        if (up.error) return { success: false, error: up.error.message };
      } else {
        const ins = await sb.from("shareholder").insert({
          company_id: id,
          person_id: h.kind === "PERSON" ? personId : null,
          parent_company_id: h.kind === "PARENT_COMPANY" ? parentId : null,
          share_pct: h.share_pct,
          is_manager: h.is_manager,
          kyc_status: h.kind === "PERSON" ? "NOT_STARTED" : "NOT_APPLICABLE",
        });
        if (ins.error) return { success: false, error: ins.error.message };
      }
    }
    return reload(sb, id);
  });
}

/**
 * Step 7 — KYC (SIMULATED Sumsub). `startShareholderKyc` stands for sending the
 * applicant to Sumsub; `completeShareholderKyc` stands for its webhook. No real
 * identity check happens in this demo.
 */
export async function startShareholderKyc(
  shareholderId: string
): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    const { data, error } = await sb
      .from("shareholder")
      .select("company_id, person_id")
      .eq("id", shareholderId)
      .single();
    if (error) return { success: false, error: error.message };
    if (!data.person_id) {
      return { success: false, error: "La vérification KYC ne concerne que les personnes physiques." };
    }
    const reference = `SUMSUB-SIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const up = await sb
      .from("shareholder")
      .update({ kyc_status: "PENDING", kyc_reference: reference, kyc_checked_at: null })
      .eq("id", shareholderId);
    if (up.error) return { success: false, error: up.error.message };
    console.log(`[mock Sumsub] applicant ${reference} created — no real check is performed.`);
    return reload(sb, data.company_id as string);
  });
}

export async function completeShareholderKyc(
  shareholderId: string,
  outcome: "VERIFIED" | "REJECTED"
): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    const { data, error } = await sb
      .from("shareholder")
      .select("company_id, kyc_status")
      .eq("id", shareholderId)
      .single();
    if (error) return { success: false, error: error.message };
    if (data.kyc_status !== "PENDING") {
      return { success: false, error: "Lancez d'abord la vérification." };
    }
    await new Promise((r) => setTimeout(r, 500));
    const up = await sb
      .from("shareholder")
      .update({ kyc_status: outcome, kyc_checked_at: new Date().toISOString() })
      .eq("id", shareholderId);
    if (up.error) return { success: false, error: up.error.message };
    return reload(sb, data.company_id as string);
  });
}

/** Step 8: records a document the browser already uploaded to Storage. */
export async function recordCompanyDocument(
  companyId: string,
  input: {
    required_document_id: string;
    shareholder_id: string | null;
    file_url: string;
    file_name: string;
    file_size: number;
  }
): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    let del = sb
      .from("company_document")
      .delete()
      .eq("company_id", companyId)
      .eq("required_document_id", input.required_document_id);
    del = input.shareholder_id
      ? del.eq("shareholder_id", input.shareholder_id)
      : del.is("shareholder_id", null);
    const d = await del;
    if (d.error) return { success: false, error: d.error.message };
    const { error } = await sb.from("company_document").insert({
      company_id: companyId,
      required_document_id: input.required_document_id,
      shareholder_id: input.shareholder_id,
      file_url: input.file_url,
      file_name: input.file_name,
      file_size: input.file_size,
    });
    if (error) return { success: false, error: error.message };
    return reload(sb, companyId);
  });
}

export async function removeCompanyDocument(
  companyId: string,
  documentId: string
): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    const { error } = await sb
      .from("company_document")
      .delete()
      .eq("id", documentId)
      .eq("company_id", companyId);
    if (error) return { success: false, error: error.message };
    return reload(sb, companyId);
  });
}

/** Step 9: the quote computed by the database (package + office + MAO fee). */
/** Mainland: who provides the Ejari lease (the company itself, or MAO). */
export async function saveCompanyLease(
  id: string,
  mode: LeaseMode | null
): Promise<ActionResult<CompanyFile>> {
  if (mode !== null && mode !== "OWN" && mode !== "MAO") {
    return { success: false, error: "Choix invalide." };
  }
  return withDb(async (sb) => {
    const { file } = await load(sb, id);
    const notDraft = requireDraft(file);
    if (notDraft) return { success: false, error: notDraft };
    if (file.jurisdiction_type !== "MAINLAND") {
      return { success: false, error: "Le bail Ejari ne concerne que le mainland." };
    }
    const { error } = await sb.from("company").update({ lease_mode: mode }).eq("id", id);
    if (error) return { success: false, error: error.message };
    return reload(sb, id);
  });
}

export async function getCompanyQuote(
  id: string
): Promise<
  ActionResult<{ packageAed: number; officeAed: number; maoFeeAed: number; totalAed: number }>
> {
  return withDb(async (sb) => {
    const { data, error } = await sb.rpc("company_quote", { p_company: id });
    if (error) return { success: false, error: error.message };
    const row = (Array.isArray(data) ? data[0] : data) as
      | {
          package_price_aed: number;
          office_price_aed: number;
          mao_fee_aed: number;
          total_aed: number;
        }
      | undefined;
    if (!row) return { success: false, error: "Aucun tarif applicable." };
    return {
      success: true,
      data: {
        packageAed: Number(row.package_price_aed),
        officeAed: Number(row.office_price_aed),
        maoFeeAed: Number(row.mao_fee_aed),
        totalAed: Number(row.total_aed),
      },
    };
  });
}

/** Everything the submission checks, from a hydrated file. */
function snapshotOf(file: CompanyFile, catalog: CompanyCatalog, paid: boolean): SubmissionSnapshot {
  const holders = file.shareholders.map((s) => ({
    isPerson: s.person_id !== null,
    sharePct: Number(s.share_pct),
    isManager: s.is_manager,
  }));
  const missing =
    file.authority_id && file.legal_form_id
      ? documentChecklist(
          file.authority_id,
          file.legal_form_id,
          file.activity_ids,
          catalog.requiredDocuments,
          file.shareholders.map((s) => ({
            id: s.id,
            isPerson: s.person_id !== null,
            isManager: s.is_manager,
            isParentCompany: s.parent_company_id !== null,
          })),
          file.documents,
          file.lease_mode
        ).filter((i) => !i.provided && !i.optional).length
      : 0;
  return {
    jurisdiction: file.jurisdiction_type,
    authorityId: file.authority_id,
    legalFormId: file.legal_form_id,
    clientChoice: file.client_choice,
    officeTypeId: file.office_type_id,
    visaQuota: file.visa_quota,
    activityIds: file.activity_ids,
    names: file.names.filter((n) => n.rank <= 3).map((n) => n.proposed_name),
    holders,
    leaseMode: file.lease_mode,
    missingDocuments: missing,
    paymentPaid: paid,
  };
}

/**
 * Steps 9 + 10: SIMULATED payment, which triggers the submission to the guichet.
 * Nothing is charged; the guichet submission itself is handled by hand in the
 * Backoffice MAO ("/backoffice/societes").
 */
export async function payAndSubmitCompany(
  id: string,
  requesterName?: string
): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    const { file, catalog } = await load(sb, id);
    const notDraft = requireDraft(file);
    if (notDraft) return { success: false, error: notDraft };

    const issues = submissionIssues(snapshotOf(file, catalog, true), {
      legalForms: catalog.legalForms,
      links: catalog.authorityLegalForms,
      activities: catalog.activities,
      licenceTypes: catalog.licenceTypes,
      officeOptions: catalog.officeOptions,
      officeTypes: catalog.officeTypes,
    });
    if (issues.length > 0) return { success: false, error: issues[0].code, issues };

    if (file.payment?.status !== "PAID") {
      const quote = await getCompanyQuote(id);
      if (!quote.success || !quote.data) return { success: false, error: quote.error };
      const q = quote.data;
      const amounts = {
        package_price_aed: q.packageAed,
        office_price_aed: q.officeAed,
        mao_fee_aed: q.maoFeeAed,
        total_aed: q.totalAed,
      };
      if (file.payment) {
        const up = await sb.from("company_payment").update(amounts).eq("id", file.payment.id);
        if (up.error) return { success: false, error: up.error.message };
      } else {
        const ins = await sb
          .from("company_payment")
          .insert({ company_id: id, reference: generatePaymentReference(), ...amounts });
        if (ins.error) return { success: false, error: ins.error.message };
      }
      await new Promise((r) => setTimeout(r, 700)); // simulated payment provider
      const paid = await sb
        .from("company_payment")
        .update({ status: "PAID", paid_at: new Date().toISOString() })
        .eq("company_id", id);
      if (paid.error) return { success: false, error: paid.error.message };
    }

    const { error } = await sb
      .from("company")
      .update({
        status: "SUBMITTED",
        tracking_reference: file.tracking_reference ?? generateTrackingReference(),
        ...(requesterName?.trim() ? { requester_name: requesterName.trim() } : {}),
      })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return reload(sb, id);
  });
}

export async function deleteCompanyDraft(id: string): Promise<ActionResult> {
  return withDb(async (sb) => {
    const { data, error } = await sb.from("company").select("status").eq("id", id).single();
    if (error) return { success: false, error: error.message };
    if (data.status !== "DRAFT") {
      return { success: false, error: "Seul un brouillon peut être supprimé." };
    }
    const del = await sb.from("company").delete().eq("id", id);
    if (del.error) return { success: false, error: del.error.message };
    revalidateAll();
    return { success: true };
  });
}

/* ------------------------------------------------- Backoffice MAO (manual) */

async function transition(
  sb: Sb,
  id: string,
  to: Company["status"],
  extra: Record<string, unknown> = {}
): Promise<ActionResult<CompanyFile>> {
  const { data, error } = await sb.from("company").select("status").eq("id", id).single();
  if (error) return { success: false, error: error.message };
  if (!canTransition(data.status, to)) {
    return { success: false, error: `Transition ${data.status} → ${to} impossible.` };
  }
  const up = await sb.from("company").update({ status: to, ...extra }).eq("id", id);
  if (up.error) return { success: false, error: up.error.message };
  return reload(sb, id);
}

/** SUBMITTED → IN_REVIEW: the file was sent to the guichet by hand. */
export async function startCompanyReview(id: string): Promise<ActionResult<CompanyFile>> {
  return withDb((sb) => transition(sb, id, "IN_REVIEW"));
}

/** The guichet approved one of the proposed names. */
export async function approveCompanyName(
  id: string,
  nameRequestId: string
): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    const { data: names, error } = await sb
      .from("company_name_request")
      .select("*")
      .eq("company_id", id);
    if (error) return { success: false, error: error.message };
    const chosen = (names as CompanyNameRequest[]).find((n) => n.id === nameRequestId);
    if (!chosen || chosen.status !== "PENDING") {
      return { success: false, error: "Ce nom ne peut pas être approuvé." };
    }
    // the identity check (KYC) is part of the MAO review
    const { data: holders, error: holdersError } = await sb
      .from("shareholder")
      .select("person_id, share_pct, is_manager, kyc_status")
      .eq("company_id", id);
    if (holdersError) return { success: false, error: holdersError.message };
    const kycIssues = nameApprovalIssues(
      (holders ?? []).map((h) => ({
        isPerson: h.person_id !== null,
        sharePct: Number(h.share_pct),
        isManager: Boolean(h.is_manager),
        kycVerified: h.kyc_status === "VERIFIED",
      }))
    );
    if (kycIssues.length > 0) {
      return { success: false, error: kycIssues[0].code, issues: kycIssues };
    }
    const a = await sb
      .from("company_name_request")
      .update({ status: "APPROVED" })
      .eq("id", nameRequestId);
    if (a.error) return { success: false, error: a.error.message };
    const others = (names as CompanyNameRequest[]).filter(
      (n) => n.id !== nameRequestId && n.status === "PENDING"
    );
    if (others.length > 0) {
      const r = await sb
        .from("company_name_request")
        .update({ status: "REJECTED", rejection_reason: "Une autre proposition a été retenue." })
        .in("id", others.map((n) => n.id));
      if (r.error) return { success: false, error: r.error.message };
    }
    return transition(sb, id, "NAME_APPROVED", { trade_name: chosen.proposed_name });
  });
}

/**
 * The guichet refused a name (reason required). When no proposal is left
 * pending, the company moves to NAME_REJECTED and the client must propose new ones.
 */
export async function rejectCompanyName(
  id: string,
  nameRequestId: string,
  reason: string
): Promise<ActionResult<CompanyFile>> {
  const why = reason.trim();
  if (!why) return { success: false, error: "Indiquez le motif du refus du nom." };
  return withDb(async (sb) => {
    const r = await sb
      .from("company_name_request")
      .update({ status: "REJECTED", rejection_reason: why })
      .eq("id", nameRequestId)
      .eq("company_id", id);
    if (r.error) return { success: false, error: r.error.message };
    const { data, error } = await sb
      .from("company_name_request")
      .select("status")
      .eq("company_id", id);
    if (error) return { success: false, error: error.message };
    const pending = (data ?? []).filter((n) => n.status === "PENDING").length;
    if (pending === 0) return transition(sb, id, "NAME_REJECTED");
    return reload(sb, id);
  });
}

/** NAME_REJECTED: the client sends new proposals, the file goes back in review. */
export async function proposeNewCompanyNames(
  id: string,
  names: string[]
): Promise<ActionResult<CompanyFile>> {
  const cleaned = names.map((n) => n.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (cleaned.length === 0 || cleaned.length > 3) {
    return { success: false, error: "Proposez entre 1 et 3 nouveaux noms." };
  }
  return withDb(async (sb) => {
    const { file } = await load(sb, id);
    if (file.status !== "NAME_REJECTED") {
      return { success: false, error: "Aucun nouveau nom n'est attendu pour ce dossier." };
    }
    const issues = validateNameProposals(
      cleaned.length === 3 ? cleaned : [...cleaned, ...Array(3 - cleaned.length).fill("")]
    ).filter((i) => i.code !== "NAMES_THREE_REQUIRED");
    // blank filler slots are not real proposals: ignore their errors
    const real = issues.filter((i) => Number(i.params?.rank ?? 0) <= cleaned.length);
    if (real.length > 0) return { success: false, error: real[0].code, issues: real };
    const taken = file.names.map((n) => n.proposed_name.trim().toLowerCase());
    if (cleaned.some((n) => taken.indexOf(n.toLowerCase()) !== -1)) {
      return { success: false, error: "NAMES_DUPLICATE", issues: [{ code: "NAMES_DUPLICATE" }] };
    }
    const maxRank = file.names.reduce((m, n) => Math.max(m, n.rank), 0);
    if (cleaned.length === 0) return reload(sb, id);
    const ins = await sb.from("company_name_request").insert(
      cleaned.map((proposed_name, i) => ({
        company_id: id,
        proposed_name,
        rank: maxRank + i + 1,
      }))
    );
    if (ins.error) return { success: false, error: ins.error.message };
    return transition(sb, id, "IN_REVIEW");
  });
}

/** NAME_APPROVED → INITIAL_APPROVAL. */
export async function grantCompanyInitialApproval(
  id: string
): Promise<ActionResult<CompanyFile>> {
  return withDb((sb) => transition(sb, id, "INITIAL_APPROVAL"));
}

/** INITIAL_APPROVAL → LICENCE_ISSUED: attributes the licence ("Traitement des licences"). */
export async function issueCompanyLicence(id: string): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    const { file } = await load(sb, id);
    const issuedAt = new Date();
    const number = generateLicenceNumber(file.authority?.code ?? "GEN");
    const expires = computeLicenceExpiry(issuedAt);
    const entry: CompanyLicenceHistoryEntry = {
      action: "attribuee",
      number,
      type: file.licence_type?.label ?? "",
      expires_at: expires,
      changed_at: issuedAt.toISOString(),
    };
    return transition(sb, id, "LICENCE_ISSUED", {
      licence_number: number,
      licence_issued_at: issuedAt.toISOString(),
      licence_expires_at: expires,
      licence_history: [...file.licence_history, entry],
    });
  });
}

export async function rejectCompany(
  id: string,
  reason: string
): Promise<ActionResult<CompanyFile>> {
  const why = reason.trim();
  if (!why) return { success: false, error: "Indiquez un motif de refus." };
  return withDb((sb) => transition(sb, id, "REJECTED", { rejection_reason: why }));
}

/** Renews an issued licence for one more year. */
export async function renewCompanyLicence(
  id: string,
  ticketReference?: string
): Promise<ActionResult<CompanyFile>> {
  return withDb(async (sb) => {
    const { file } = await load(sb, id);
    if (file.status !== "LICENCE_ISSUED" || !file.licence_number) {
      return { success: false, error: "Aucune licence à renouveler pour cette société." };
    }
    const now = new Date();
    const expires = computeLicenceExpiry(now);
    const entry: CompanyLicenceHistoryEntry = {
      action: "renouvelee",
      number: file.licence_number,
      type: file.licence_type?.label ?? "",
      expires_at: expires,
      changed_at: now.toISOString(),
    };
    const tickets = ticketReference
      ? file.licence_renewal_tickets.map((t) =>
          t.reference === ticketReference ? { ...t, status: "traite" } : t
        )
      : file.licence_renewal_tickets;
    const up = await sb
      .from("company")
      .update({
        licence_expires_at: expires,
        licence_history: [...file.licence_history, entry],
        licence_renewal_tickets: tickets,
      })
      .eq("id", id);
    if (up.error) return { success: false, error: up.error.message };
    if (ticketReference) await markLicenseRenewalTicketProcessed(ticketReference);
    return reload(sb, id);
  });
}

/** Mock "request licence renewal" (no real email): ticket on the company + shared inbox. */
export async function requestCompanyLicenceRenewal(
  id: string,
  message?: string
): Promise<ActionResult<{ ticket: CompanyRenewalTicket }>> {
  return withDb(async (sb) => {
    await new Promise((r) => setTimeout(r, 600));
    const { file } = await load(sb, id);
    const reference = generateLicenseTicketReference();
    const createdAt = new Date().toISOString();
    const ticket: CompanyRenewalTicket = {
      reference,
      created_at: createdAt,
      message: message?.trim() ?? "",
      status: "ouvert",
    };
    console.log(
      `[mock notification] Licence renewal ticket ${reference} "sent" to mao@support for company ${id}. No real email was dispatched.`
    );
    const up = await sb
      .from("company")
      .update({ licence_renewal_tickets: [...file.licence_renewal_tickets, ticket] })
      .eq("id", id);
    if (up.error) return { success: false, error: up.error.message };
    await recordLicenseRenewalTicket({
      reference,
      created_at: createdAt,
      message: ticket.message,
      company_id: id,
      company_name: file.trade_name ?? file.names[0]?.proposed_name ?? null,
      requester_name: file.requester_name,
    });
    revalidateAll();
    return { success: true, data: { ticket } };
  });
}
