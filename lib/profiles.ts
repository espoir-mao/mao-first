/**
 * Connection profiles.
 *
 * - SOCIETE: a company user — the société area (dashboard, À propos, Licence,
 *   creation flow) and its Administration (requests, visas, users).
 * - BACKOFFICE: a MAO team user — access to everything, including the
 *   Backoffice MAO area and the Support inbox.
 *
 * Which profiles an account may use comes from the SERVER-controlled
 * `app_metadata.profiles` of the Supabase Auth user (editable only with the
 * service role — see the README for the SQL). For the demo, the e-mails listed
 * in DEMO_MULTI_PROFILE_EMAILS (and in NEXT_PUBLIC_DEMO_MULTI_PROFILE_EMAILS,
 * comma separated) get both profiles and can switch between them.
 * No runtime imports: unit-tested with `node --test`.
 */

export type Profile = "SOCIETE" | "BACKOFFICE";
export const PROFILES: readonly Profile[] = ["SOCIETE", "BACKOFFICE"];

export const DEMO_MULTI_PROFILE_EMAILS: readonly string[] = ["espoirbatawila@conanjeken.com"];

/** Areas only the MAO backoffice profile may open. */
const BACKOFFICE_ONLY_PREFIXES = ["/backoffice", "/support"] as const;

function isProfile(x: unknown): x is Profile {
  return x === "SOCIETE" || x === "BACKOFFICE";
}

/** The profiles an account may use (never empty: a plain account is a société user). */
export function allowedProfiles(input: {
  email?: string | null;
  appMetadataProfiles?: unknown;
  extraDemoEmails?: string | null;
  /** No authentication available (demo without Supabase): everything is open. */
  unauthenticatedDemo?: boolean;
}): Profile[] {
  if (input.unauthenticatedDemo) return ["SOCIETE", "BACKOFFICE"];
  const fromMeta = Array.isArray(input.appMetadataProfiles)
    ? PROFILES.filter((p) => (input.appMetadataProfiles as unknown[]).some((x) => x === p))
    : [];
  if (fromMeta.length > 0) {
    // a backoffice user also has the société area
    return fromMeta.indexOf("SOCIETE") === -1 ? ["SOCIETE", ...fromMeta] : fromMeta;
  }
  const email = (input.email ?? "").trim().toLowerCase();
  const demo = [
    ...DEMO_MULTI_PROFILE_EMAILS,
    ...(input.extraDemoEmails ?? "").split(","),
  ].map((e) => e.trim().toLowerCase());
  if (email && demo.indexOf(email) !== -1) return ["SOCIETE", "BACKOFFICE"];
  return ["SOCIETE"];
}

/** The profile in use: the stored one when still allowed, otherwise the first allowed. */
export function resolveActiveProfile(allowed: Profile[], stored: unknown): Profile {
  if (isProfile(stored) && allowed.indexOf(stored) !== -1) return stored;
  return allowed[0] ?? "SOCIETE";
}

export function canAccess(profile: Profile, pathname: string | null | undefined): boolean {
  if (profile === "BACKOFFICE") return true;
  const p = pathname ?? "/";
  return !BACKOFFICE_ONLY_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function isRestrictedPath(pathname: string | null | undefined): boolean {
  return !canAccess("SOCIETE", pathname);
}

/** Where a person lands after switching profile. */
export function landingFor(profile: Profile): string {
  return profile === "BACKOFFICE" ? "/backoffice/societes" : "/";
}
