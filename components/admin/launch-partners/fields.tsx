"use client";

import { useState } from "react";

/** The small form kit the launch-partner editor sections share. */
export const inputCls = "mt-1 block w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-ink-soft">
      {label}
      {hint && <span className="ml-1 font-normal text-ink-muted">{hint}</span>}
      {children}
    </label>
  );
}

export function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 rounded-card border border-line bg-paper p-5 shadow-soft">
      <h2 id={`${id}-h`} className="font-display text-xl font-bold text-ink">{title}</h2>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Save button + inline outcome for one section. `onSave` returns an error message or null. */
export function SaveBar({ onSave, label = "Save", disabled }: { onSave: () => Promise<string | null | undefined>; label?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy || disabled} onClick={async () => {
        setBusy(true); setMsg(null);
        const e = await onSave();
        setBusy(false); setMsg(e ? { ok: false, text: e } : { ok: true, text: "Saved." });
      }} className="rounded-pill bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">{busy ? "Saving…" : label}</button>
      {msg && <p role="status" className={"text-sm font-semibold " + (msg.ok ? "text-emerald-700" : "text-rose-700")}>{msg.text}</p>}
    </div>
  );
}

export const lines = (s: string): string[] => s.split(/\n{2,}|\r\n{2,}/).map((x) => x.trim()).filter(Boolean);
export const commaList = (s: string): string[] => s.split(",").map((x) => x.trim()).filter(Boolean);
