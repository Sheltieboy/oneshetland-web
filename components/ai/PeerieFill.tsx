"use client";

import { useState } from "react";
import { AiGlow } from "@/components/ai/AiGlow";
import { PEERIE, RING_COLOURS } from "@/lib/peerie";

/**
 * PeerieFill — the reusable "describe it and Peerie Bot fills the form" card.
 * Drop it at the top of any form: give it a parse endpoint, a placeholder, the
 * form's accent, and an `onFill` that maps the returned fields onto the form's
 * state. It owns the textarea + busy/error/done state and lights its own border
 * (AiGlow) while working; pass `onBusyChange` so the parent can glow its fields
 * too. Peerie Bot only ever pre-fills — the user reviews before submitting.
 */
export function PeerieFill({
  endpoint,
  placeholder,
  accent,
  instruction,
  onFill,
  onBusyChange,
}: {
  endpoint: string;
  placeholder: string;
  accent: string;
  instruction?: string;
  onFill: (data: Record<string, unknown>) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run() {
    if (!text.trim()) return;
    setError(null); setDone(false); setBusy(true); onBusyChange?.(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as { error?: string })?.error || `${PEERIE.name} couldn't read that.`);
      onFill(d as Record<string, unknown>);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false); onBusyChange?.(false);
    }
  }

  return (
    <AiGlow active={busy}>
      <section className="space-y-3 rounded-card border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full text-sm text-paper shadow-soft"
            style={{ background: `conic-gradient(${RING_COLOURS.join(", ")}, ${RING_COLOURS[0]})` }}>{PEERIE.spark}</span>
          <div>
            <h2 className="font-display text-lg font-bold leading-none">{PEERIE.name}</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{PEERIE.role}</span>
          </div>
          <span className="ml-1 rounded-pill bg-ink/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">{PEERIE.tag}</span>
        </div>
        <p className="text-sm text-ink-soft">
          {instruction ?? `Describe it in plain English and ${PEERIE.name} will fill in the form below — check and tweak anything before you post.`}
        </p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={placeholder} className="auth-input resize-none" />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={run} disabled={busy || !text.trim()}
            className="rounded-pill px-5 py-2.5 font-semibold text-paper shadow-soft transition hover:brightness-95 disabled:opacity-50"
            style={{ background: accent }}>
            {busy ? `${PEERIE.name} is working…` : `${PEERIE.spark} Fill in with ${PEERIE.name}`}
          </button>
          {done && !busy && <span className="text-sm font-semibold text-emerald-600">Filled in below — have a look ✓</span>}
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </section>
    </AiGlow>
  );
}
