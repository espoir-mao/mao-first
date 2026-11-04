"use server";

import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabaseClient";
import type { ActionResult } from "@/lib/types";

/**
 * Who the bell is for. Until user profiles exist (société user vs MAO
 * backoffice user) the audience is chosen by the client from the area the
 * person is in; the data itself is always scoped here, on the server:
 * SOCIETE only ever receives what concerns the given company, BACKOFFICE
 * receives what companies sent to MAO.
 */
export type NotificationAudience = "SOCIETE" | "BACKOFFICE";

export type NotificationKind =
  | "REQUEST_RECEIVED" // société: MAO raised a request on its file / a visa
  | "ANSWER_RECEIVED" // backoffice: a société answered a request
  | "PROFILE_REQUEST" // backoffice: profile change request to process
  | "SUPPORT_TICKET" // backoffice: support / licence renewal ticket to process
  | "FILE_SUBMITTED"; // backoffice: a company file waits for review

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  at: string;
  href: string;
  /** Company concerned (backoffice only; a société only sees its own). */
  company: string | null;
  /** Raw reference / section code, translated by the client. */
  ref: string;
  section: string | null;
  /** The request still blocks the next step. */
  blocking: boolean;
}

const LIMIT = 30;

export async function listNotifications(input: {
  audience: NotificationAudience;
  companyId?: string | null;
}): Promise<ActionResult<AppNotification[]>> {
  if (!isSupabaseConfigured()) return { success: true, data: [] };
  try {
    const sb = getSupabaseClient();
    const items: AppNotification[] = [];

    if (input.audience === "SOCIETE") {
      // strict scoping: no company, nothing
      if (!input.companyId) return { success: true, data: [] };
      const { data, error } = await sb
        .from("company_correction_request")
        .select("id, created_at, reference, section, is_blocking")
        .eq("company_id", input.companyId)
        .eq("status", "OUVERT")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) return { success: false, error: error.message };
      for (const r of data ?? []) {
        items.push({
          id: `cor:${r.id}`,
          kind: "REQUEST_RECEIVED",
          at: r.created_at,
          href: "/administration/demandes",
          company: null,
          ref: r.reference,
          section: r.section,
          blocking: r.is_blocking !== false,
        });
      }
      return { success: true, data: items };
    }

    // BACKOFFICE
    const [answers, profiles, tickets, files] = await Promise.all([
      sb
        .from("company_correction_request")
        .select("id, company_id, answered_at, created_at, reference, section, is_blocking")
        .eq("status", "REPONDU")
        .order("answered_at", { ascending: false })
        .limit(LIMIT),
      sb
        .from("profile_change_request")
        .select("id, created_at, reference, company_id, company_name")
        .eq("status", "ouvert")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      sb
        .from("support_tickets")
        .select("id, created_at, reference, type, company_id, company_name")
        .eq("status", "ouvert")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      sb
        .from("company")
        .select("id, updated_at, tracking_reference, trade_name")
        .eq("status", "SUBMITTED")
        .order("updated_at", { ascending: false })
        .limit(LIMIT),
    ]);
    if (answers.error) return { success: false, error: answers.error.message };

    // names of the companies behind the answers
    const ids = Array.from(new Set((answers.data ?? []).map((r) => r.company_id as string)));
    const names = new Map<string, string>();
    if (ids.length > 0) {
      const c = await sb.from("company").select("id, trade_name").in("id", ids);
      (c.data ?? []).forEach((x) => x.trade_name && names.set(x.id as string, x.trade_name as string));
      const missing = ids.filter((i) => !names.has(i));
      if (missing.length > 0) {
        const n = await sb
          .from("company_name_request")
          .select("company_id, proposed_name")
          .in("company_id", missing)
          .eq("rank", 1);
        (n.data ?? []).forEach((x) => names.set(x.company_id as string, x.proposed_name as string));
      }
    }

    for (const r of answers.data ?? []) {
      items.push({
        id: `cor:${r.id}`,
        kind: "ANSWER_RECEIVED",
        at: (r.answered_at ?? r.created_at) as string,
        href: `/backoffice/demandes?company=${r.company_id}`,
        company: names.get(r.company_id as string) ?? null,
        ref: r.reference,
        section: r.section,
        blocking: r.is_blocking !== false,
      });
    }
    for (const r of profiles.data ?? []) {
      items.push({
        id: `prof:${r.id}`,
        kind: "PROFILE_REQUEST",
        at: r.created_at,
        href: "/backoffice/profils",
        company: r.company_name ?? null,
        ref: r.reference,
        section: null,
        blocking: false,
      });
    }
    for (const r of tickets.data ?? []) {
      items.push({
        id: `tk:${r.id}`,
        kind: "SUPPORT_TICKET",
        at: r.created_at,
        href: r.type === "license_renewal" ? "/backoffice/licences" : "/backoffice/demandes?tab=contact",
        company: r.company_name ?? null,
        ref: r.reference,
        section: null,
        blocking: false,
      });
    }
    for (const r of files.data ?? []) {
      items.push({
        id: `file:${r.id}`,
        kind: "FILE_SUBMITTED",
        at: r.updated_at,
        href: "/backoffice/societes",
        company: r.trade_name ?? null,
        ref: r.tracking_reference ?? "",
        section: null,
        blocking: false,
      });
    }
    items.sort((a, b) => b.at.localeCompare(a.at));
    return { success: true, data: items };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}
