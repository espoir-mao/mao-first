"use client";

import type { ReactNode } from "react";

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>;
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="break-words text-sm text-neutral-800">{empty ? "—" : value}</dd>
    </div>
  );
}

export function FileLink({ url, name, size }: { url: string; name: string; size?: number }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-[#d7e0cc] bg-[#f8faf5] px-3 py-1 text-xs font-semibold text-[#4f7a37] hover:underline"
    >
      📎 {name}
      {size ? <span className="font-normal text-neutral-400">({Math.max(1, Math.round(size / 1024))} Ko)</span> : null}
    </a>
  );
}

export const smallBtn =
  "rounded-full bg-[#7a9a5a] px-4 py-2 text-xs font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60";
export const smallBtnSecondary =
  "rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60";
