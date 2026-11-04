import type { User } from "@supabase/supabase-js";

/**
 * Small shared helpers for deriving a display name / avatar initials / photo
 * URL from a Supabase Auth user. `first_name` / `last_name` are set at
 * signup (see `signUpWithPassword` in lib/auth.ts) and `avatar_url` is set
 * later from the /profil page once the person uploads a photo.
 */

export function getUserFirstName(user: User | null | undefined): string {
  return (user?.user_metadata?.first_name as string | undefined)?.trim() ?? "";
}

export function getUserLastName(user: User | null | undefined): string {
  return (user?.user_metadata?.last_name as string | undefined)?.trim() ?? "";
}

export function getUserAvatarUrl(
  user: User | null | undefined
): string | null {
  const url = user?.user_metadata?.avatar_url as string | undefined;
  return url && url.trim() ? url : null;
}

export function getUserDisplayName(user: User | null | undefined): string {
  const firstName = getUserFirstName(user);
  const lastName = getUserLastName(user);
  const full = `${firstName} ${lastName}`.trim();
  return full || user?.email || "";
}

/**
 * Two-letter initials from first_name/last_name, falling back to the first
 * two letters of the email when those metadata fields aren't present.
 */
export function getUserInitials(user: User | null | undefined): string {
  const firstName = getUserFirstName(user);
  const lastName = getUserLastName(user);

  if (firstName || lastName) {
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    if (initials) return initials;
  }

  const email = user?.email ?? "";
  return email.slice(0, 2).toUpperCase() || "?";
}
