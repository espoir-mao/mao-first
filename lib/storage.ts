export const DOCUMENTS_BUCKET = "societes-documents";

/** Supabase Storage bucket for documents uploaded in the visa module. Kept
 * separate from `DOCUMENTS_BUCKET` so the two modules' files never mix. */
export const VISA_DOCUMENTS_BUCKET = "visa-documents";

/** Supabase Storage bucket for user profile avatar photos. */
export const AVATAR_BUCKET = "avatars";

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg"];

export const MAX_AVATAR_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
