import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-created Supabase client.
 *
 * We intentionally do NOT read env vars or call createClient() at module
 * load time in a way that throws — Next.js evaluates modules during
 * `next build` (for route/page collection) even though no request is being
 * served, and the Supabase env vars are not guaranteed to be present at
 * build time (e.g. in CI, or this sandbox). Throwing here would crash the
 * build. Instead we only validate/instantiate when `getSupabaseClient()`
 * is actually called, which happens at request/interaction time (inside
 * server actions or client-side event handlers).
 */

let cachedClient: SupabaseClient | null = null;

export class SupabaseConfigError extends Error {
  constructor() {
    super(
      "Supabase n'est pas configuré. Ajoutez NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY dans votre fichier .env.local (voir " +
        ".env.local.example), puis redémarrez le serveur."
    );
    this.name = "SupabaseConfigError";
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new SupabaseConfigError();
  }

  // Next.js caches server-side `fetch` GETs (Data Cache); this app always
  // needs live rows (a guichet decision must show up immediately), so every
  // request opts out of that cache.
  cachedClient = createClient(url, anonKey, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return cachedClient;
}
