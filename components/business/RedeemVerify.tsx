"use client";

import { useState } from "react";
import { verifyRedemption } from "@/lib/loyalty-redeem-client";

/**
 * RedeemVerify — staff confirm a customer's redemption code (business side, web).
 * Type the 4-character code the customer is showing; the backbone applies the
 * effect and reports what it was. (Camera QR scan is the app's job; the web tool
 * is the reliable manual path.)
 */
export function RedeemVerify({ accent }: { accent: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; title: string; subtitle?: string } | null>(null);

  async function submit() {
    if (code.length !== 4 || busy) return;
    setBusy(true);
    try {
      const r = await verifyRedemption({ code });
      setResult({ ok: true, title: r.detail?.title ?? "Redeemed", subtitle: r.detail?.subtitle });
    } catch (e) {
      setResult({ ok: false, title: "Not valid", subtitle: e instanceof Error ? e.message : undefined });
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <h3 className="font-display text-lg font-bold text-ink">Confirm a redemption</h3>
      <p className="mt-1 text-sm text-ink-muted">Type the code the customer is showing to redeem their offer, reward or pass.</p>
      {result ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-sand/40 p-4">
          <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg text-paper " + (result.ok ? "bg-emerald-600" : "bg-rose-600")}>{result.ok ? "✓" : "✕"}</span>
          <div className="min-w-0">
            <p className="font-display font-bold text-ink">{result.title}</p>
            {result.subtitle && <p className="text-sm text-ink-muted">{result.subtitle}</p>}
          </div>
          <button onClick={() => { setResult(null); setCode(""); }} className="ml-auto shrink-0 rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">Next</button>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="ABCD"
            className="w-40 rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-center text-2xl font-black tracking-[0.3em] text-ink outline-none focus:border-local"
          />
          <button onClick={submit} disabled={code.length !== 4 || busy}
            className="rounded-pill px-6 py-2.5 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40"
            style={{ background: accent }}>
            {busy ? "Confirming…" : "Confirm"}
          </button>
        </div>
      )}
    </div>
  );
}
