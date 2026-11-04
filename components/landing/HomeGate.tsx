"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import Landing from "./Landing";

/**
 * "/" shows the public MAO landing page to visitors, and the société dashboard
 * (children) to signed-in users.
 */
export default function HomeGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "visitor" | "user">("loading");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState("visitor");
      return;
    }
    getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => setState(data.session ? "user" : "visitor"))
      .catch(() => setState("visitor"));
  }, []);

  if (state === "loading") return <div className="min-h-screen w-full bg-[#0d1e27]" />;
  if (state === "visitor") return <Landing />;
  return <>{children}</>;
}
