"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { allowedProfiles, resolveActiveProfile, type Profile } from "@/lib/profiles";

const STORAGE_KEY = "mao.activeProfile";

interface ProfileContextValue {
  /** false until the session has been read (avoids flashing a "forbidden" screen). */
  ready: boolean;
  user: User | null;
  allowed: Profile[];
  active: Profile;
  setActive: (profile: Profile) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The connection profile of the signed-in account (société user / MAO backoffice
 * user) and, for accounts that have both, the one currently in use.
 */
export default function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    setStored(readStored());
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    let alive = true;
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const allowed = useMemo(
    () =>
      allowedProfiles({
        email: user?.email,
        appMetadataProfiles: user?.app_metadata?.profiles,
        extraDemoEmails: process.env.NEXT_PUBLIC_DEMO_MULTI_PROFILE_EMAILS ?? null,
        unauthenticatedDemo: !isSupabaseConfigured(),
      }),
    [user]
  );
  const active = resolveActiveProfile(allowed, stored);

  const setActive = useCallback(
    (profile: Profile) => {
      if (allowed.indexOf(profile) === -1) return;
      setStored(profile);
      try {
        window.localStorage.setItem(STORAGE_KEY, profile);
      } catch {
        // non-critical
      }
    },
    [allowed]
  );

  const value = useMemo(() => ({ ready, user, allowed, active, setActive }), [ready, user, allowed, active, setActive]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
  return ctx;
}
