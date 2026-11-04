/**
 * Minimal e-mail sender (Resend HTTP API, no dependency). Configure with:
 *   RESEND_API_KEY      API key (required, otherwise nothing is sent)
 *   CONTACT_FROM_EMAIL  verified sender, e.g. "MAO <no-reply@mao.com>"
 *   CONTACT_TO_EMAIL    recipient of "Nous contacter" (default contact@mao.com)
 */
export const CONTACT_TO_DEFAULT = "contact@mao.com";

export function isMailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export async function sendMail(input: MailInput): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM_EMAIL || "MAO <onboarding@resend.dev>",
        to: [input.to],
        subject: input.subject,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${await res.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
