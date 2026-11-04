/**
 * "Nous contacter" form rules. The form is public (a visitor without account
 * can use it), so the person identifies themselves in the form. Pure: unit-tested.
 */

export interface ContactInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  /** Free text, optional (a visitor may not have a société yet). */
  company: string;
  subject: string;
  message: string;
}

export type ContactIssueCode =
  | "FIRST_NAME_REQUIRED"
  | "LAST_NAME_REQUIRED"
  | "EMAIL_INVALID"
  | "PHONE_INVALID"
  | "SUBJECT_TOO_SHORT"
  | "MESSAGE_TOO_SHORT";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+0-9][0-9 ().-]{5,24}$/;

export function validateContact(i: ContactInput): ContactIssueCode[] {
  const issues: ContactIssueCode[] = [];
  if (i.first_name.trim().length < 2) issues.push("FIRST_NAME_REQUIRED");
  if (i.last_name.trim().length < 2) issues.push("LAST_NAME_REQUIRED");
  if (!EMAIL.test(i.email.trim())) issues.push("EMAIL_INVALID");
  // the phone is optional, but when given it must look like one
  if (i.phone.trim() !== "" && !PHONE.test(i.phone.trim())) issues.push("PHONE_INVALID");
  if (i.subject.trim().length < 3) issues.push("SUBJECT_TOO_SHORT");
  if (i.message.trim().length < 10) issues.push("MESSAGE_TOO_SHORT");
  return issues;
}
