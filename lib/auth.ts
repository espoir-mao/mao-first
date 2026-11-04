"use client";

import type { Session } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "./supabaseClient";

export interface AuthResult {
  success: boolean;
  error?: string;
  /** True when the account was created but requires email confirmation. */
  needsEmailConfirmation?: boolean;
}

/**
 * Thin client-side wrappers around Supabase Auth's built-in password flows.
 * Every function is defensive about `isSupabaseConfigured()` being false so
 * the pages calling them can surface the same "configuration missing"
 * messaging used elsewhere in the app instead of crashing.
 */

export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "config" };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return { success: false, error: "config" };
    }
    return { success: false, error: "generic" };
  }
}

export async function signUpWithPassword(
  firstName: string,
  lastName: string,
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "config" };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // When email confirmations are on (Supabase's default), the new user
    // has no active session yet and must confirm their address first.
    const needsEmailConfirmation = !data.session;
    return { success: true, needsEmailConfirmation };
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return { success: false, error: "config" };
    }
    return { success: false, error: "generic" };
  }
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Best-effort — nothing else to do if Supabase isn't reachable.
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}
