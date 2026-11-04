"use server";

import { CONTACT_TO_DEFAULT, sendMail } from "@/lib/mailer";
import { revalidatePath } from "next/cache";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "@/lib/supabaseClient";
import type {
  ActionResult,
  SupportTicket,
  SupportTicketApproval,
  SupportTicketStatus,
} from "@/lib/types";
import { generateSupportTicketReference } from "@/lib/support-constants";
import { validateContact } from "@/lib/contact";

const TABLE = "support_tickets";

/**
 * Lists every ticket in the shared store (contact messages + license
 * renewal requests, across every société), newest first. The "/support"
 * page only ever shows the `contact` ones; "/backoffice/licences" reads
 * the `license_renewal` ones for its renewal queue.
 */
export async function listSupportTickets(): Promise<ActionResult<SupportTicket[]>> {
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

    return { success: true, data: (data ?? []) as SupportTicket[] };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export interface ContactTicketInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  /** Free text (a visitor may not have a société); ignored when company_id is set. */
  company_name?: string | null;
  /** Set when the person is signed in with an active société. */
  company_id?: string | null;
  subject: string;
  message: string;
  /** No session: the message comes from a visitor without account. */
  is_visitor: boolean;
  /** Honeypot: bots fill it, people never see it. */
  website?: string;
}

/**
 * Mock "contact the admin" action — same pattern as the license renewal /
 * visa appointment-preference mocks elsewhere in this app: a short
 * artificial delay, a console.log, and a generated reference. No real email
 * is sent; "mao@support" is a placeholder address.
 */
export async function createContactTicket(
  input: ContactTicketInput
): Promise<ActionResult<SupportTicket>> {
  const issues = validateContact({
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    phone: input.phone,
    company: input.company_name ?? "",
    subject: input.subject,
    message: input.message,
  });
  if (issues.length > 0) {
    return { success: false, error: issues[0], issues: issues.map((code) => ({ code })) };
  }
  const subject = input.subject.trim();
  const message = input.message.trim();

  // honeypot: pretend it worked, store nothing
  if (input.website && input.website.trim() !== "") {
    return {
      success: true,
      data: { reference: generateSupportTicketReference() } as SupportTicket,
    };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  const reference = generateSupportTicketReference();

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        type: "contact",
        reference,
        subject,
        message,
        requester_name: `${input.first_name.trim()} ${input.last_name.trim()}`,
        requester_email: input.email.trim(),
        requester_phone: input.phone.trim() || null,
        is_visitor: input.is_visitor,
        company_id: input.company_id ?? null,
        company_name: input.company_name?.trim() || null,
        status: "ouvert",
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // forward the message to the MAO contact mailbox; the ticket is already
    // stored, so a mail failure is logged but does not lose the message
    const mail = await sendMail({
      to: process.env.CONTACT_TO_EMAIL || CONTACT_TO_DEFAULT,
      replyTo: input.email.trim(),
      subject: `[Nous contacter] ${reference} - ${subject}`,
      text:
        `Référence : ${reference}\n` +
        `Nom : ${input.first_name.trim()} ${input.last_name.trim()}\n` +
        `Email : ${input.email.trim()}\n` +
        `Téléphone : ${input.phone.trim() || "-"}\n` +
        `Société : ${input.company_name?.trim() || "-"}\n` +
        `Visiteur sans compte : ${input.is_visitor ? "oui" : "non"}\n\n` +
        message,
    });
    if (!mail.ok) console.warn(`[contact] e-mail for ${reference} not sent: ${mail.error}`);

    revalidatePath("/backoffice/demandes");
    revalidatePath("/");
    return { success: true, data: data as SupportTicket };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Marks the shared ticket-store row for a license renewal request as
 * processed, by its reference — called from `renewCompanyLicence` in
 * app/actions/companies.ts right after the société's own
 * `license_renewal_tickets` entry is updated, so the
 * "/backoffice/licences" renewal queue drops it. Best-effort: logged but
 * never thrown, same as `recordLicenseRenewalTicket`.
 */
export async function markLicenseRenewalTicketProcessed(
  reference: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ status: "traite" })
      .eq("reference", reference)
      .eq("type", "license_renewal");

    if (error) {
      console.error("Impossible de mettre à jour le ticket support:", error.message);
    }
  } catch (err) {
    console.error("Impossible de mettre à jour le ticket support:", err);
  }
}

export async function updateSupportTicketStatus(
  id: string,
  status: SupportTicketStatus
): Promise<ActionResult<SupportTicket>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      // A fresh "traité" asks the société for a new verdict, so any earlier
      // approval/refusal is cleared.
      .update(
        status === "traite"
          ? { status, approval: null, approval_comment: null, approval_at: null }
          : { status }
      )
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/backoffice/demandes");
    revalidatePath("/");
    return { success: true, data: data as SupportTicket };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export interface LicenseRenewalTicketRecord {
  reference: string;
  created_at: string;
  message: string;
  company_id: string;
  company_name: string | null;
  requester_name: string | null;
}

/**
 * Internal helper called from requestLicenseRenewal (app/actions/companies.ts)
 * right after a renewal ticket is appended to the société's own
 * `license_renewal_tickets` array, so the same request also shows up in the
 * shared "/support" inbox. Failures here are logged but never fail the
 * caller — the per-société history (shown in the Licence tab) is the
 * source of truth for the person who made the request either way.
 */
export async function recordLicenseRenewalTicket(
  record: LicenseRenewalTicketRecord
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(TABLE).insert({
      type: "license_renewal",
      reference: record.reference,
      created_at: record.created_at,
      subject: record.company_name
        ? `Renouvellement de licence — ${record.company_name}`
        : "Renouvellement de licence",
      message: record.message,
      requester_name: record.requester_name,
      requester_email: null,
      company_id: record.company_id,
      company_name: record.company_name,
      status: "ouvert",
    });

    if (error) {
      console.error("Impossible d'enregistrer le ticket support:", error.message);
    }
  } catch (err) {
    console.error("Impossible d'enregistrer le ticket support:", err);
  }
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Une erreur inattendue est survenue.";
}


/**
 * "Relancer": the société nudges the admin about one of its still-open
 * tickets. Only counts the follow-up (and stamps its date) — no real
 * notification is sent in this demo. `companyId` must match the ticket's
 * société, so one société cannot act on another's tickets.
 */
export async function followUpSupportTicket(
  id: string,
  companyId: string
): Promise<ActionResult<SupportTicket>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  try {
    const supabase = getSupabaseClient();
    const { data: current, error: readError } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (readError || !current) {
      return { success: false, error: readError?.message ?? "Ticket introuvable." };
    }
    if ((current as SupportTicket).status !== "ouvert") {
      return { success: false, error: "Ce ticket n'est plus ouvert." };
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        follow_up_count: ((current as SupportTicket).follow_up_count ?? 0) + 1,
        last_follow_up_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    console.log(`[mock notification] Follow-up on ticket ${(current as SupportTicket).reference}.`);
    revalidatePath("/backoffice/demandes");
    revalidatePath("/");
    return { success: true, data: data as SupportTicket };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * The société's verdict on a ticket the admin marked as treated. Approving
 * closes the exchange; refusing (a reason is required) reopens the ticket so
 * it shows up as open again on the admin's "Support" page.
 */
export async function reviewSupportTicket(
  id: string,
  companyId: string,
  decision: SupportTicketApproval,
  comment?: string
): Promise<ActionResult<SupportTicket>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new SupabaseConfigError().message };
  }

  const trimmed = comment?.trim() ?? "";
  if (decision === "refuse" && trimmed.length < 3) {
    return { success: false, error: "Indiquez un motif (au moins 3 caractères)." };
  }

  try {
    const supabase = getSupabaseClient();
    const { data: current, error: readError } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (readError || !current) {
      return { success: false, error: readError?.message ?? "Ticket introuvable." };
    }
    if ((current as SupportTicket).status !== "traite") {
      return { success: false, error: "Ce ticket n'a pas encore été traité." };
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        approval: decision,
        approval_comment: trimmed || null,
        approval_at: new Date().toISOString(),
        status: decision === "refuse" ? "ouvert" : "traite",
      })
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/backoffice/demandes");
    revalidatePath("/");
    return { success: true, data: data as SupportTicket };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
