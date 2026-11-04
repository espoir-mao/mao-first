"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "mao.activeSociete";
const CHANGE_EVENT = "mao:active-societe-changed";

export interface ActiveSociete {
  id: string;
  name: string;
}

/**
 * Client-side only "active société" convenience selector. This is NOT a
 * real per-user backend ownership model — the `societes` table has no
 * owner/user linkage in this demo schema — it's just a small localStorage
 * flag so the UI can remember which société the person picked on
 * /choisir-societe and reflect it elsewhere (e.g. the Sidebar). All reads
 * and writes go through this module instead of scattering raw
 * `localStorage` calls across components, so it's easy to swap for a real
 * backend-backed selection later.
 */
export function readActiveSociete(): ActiveSociete | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.id === "string" &&
      typeof parsed.name === "string"
    ) {
      return { id: parsed.id, name: parsed.name };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeActiveSociete(societe: ActiveSociete): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(societe));
    // Let mounted components (Sidebar…) pick the change up straight away.
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Non-critical convenience — ignore (private browsing / blocked storage).
  }
}

export function clearActiveSociete(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

/**
 * React hook exposing the current active société, resolved only after
 * mount (so SSR and the first client render stay in sync and callers can
 * fall back to a generic label until this resolves).
 */
export function useActiveSociete(): {
  activeSociete: ActiveSociete | null;
  mounted: boolean;
} {
  const [activeSociete, setActiveSociete] = useState<ActiveSociete | null>(
    null
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setActiveSociete(readActiveSociete());
    setMounted(true);
    const onChange = () => setActiveSociete(readActiveSociete());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  return { activeSociete, mounted };
}
