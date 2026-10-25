"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAdultAction } from "@/app/fetch/actions";
import { FETCH_ACCENT, Notice, btnPrimary } from "@/components/fetch/v2/ui";

/** The one-time Fetch confirmation: members must be 18 or over to ask for, or drive, a Fetch. */
export function AdultGate() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true); setError(null);
    const r = await confirmAdultAction().catch(() => null);
    setBusy(false);
    if (r?.ok) router.refresh(); else setError(r ? r.message : "We couldn't reach OneShetland. Please try again.");
  }
  return (
    <div className="space-y-3 rounded-card border border-line bg-paper p-5 shadow-soft">
      <h2 className="font-display text-xl font-bold text-ink">Before you use Fetch</h2>
      <p className="text-sm text-ink-soft">Fetch is for members aged 18 or over — both people asking for a Fetch and drivers. You only need to confirm this once.</p>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-4 w-4" />
        I confirm I am 18 or over.
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" disabled={!checked || busy} onClick={go} className={btnPrimary} style={{ background: FETCH_ACCENT }}>{busy ? "Please wait…" : "Continue"}</button>
    </div>
  );
}
