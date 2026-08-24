"use client";

import { useState } from "react";
import { previewRedemption, verifyRedemption } from "@/lib/loyalty-redeem-client";

/**
 * RedeemVerify — staff redeem what a customer is showing (business side, web).
 *
 * THREE STEPS, AND ONLY ONE OF THEM SPENDS ANYTHING.
 *
 *   enter    type or scan the customer's 4-character code
 *   preview  READ-ONLY: what it is, and what the balance is right now
 *   done     the result, with the balance the server returned
 *
 * It used to call the mutating verify the instant the code was typed, then show
 * a panel headed "Confirm a redemption" — after the use had already been taken.
 * Staff could not tell whether they had spent the credit or were about to. The
 * database was never wrong; the screen was.
 *
 * Neither screen ever computes a balance. Preview shows what preview_redemption
 * read; the result shows what redeem_pass_atomic returned.
 */
export function RedeemVerify({ accent }: { accent: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ title: string; subtitle?: string } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; title: string; subtitle?: string } | null>(null);

  function reset() {
    setPreview(null);
    setResult(null);
    setCode("");
  }

  async function look() {
    if (code.length !== 4 || busy) return;
    setBusy(true);
    try {
      const p = await previewRedemption({ code });
      setPreview({ title: p.detail?.title ?? "Redemption", subtitle: p.detail?.subtitle });
    } catch (e) {
      setResult({ ok: false, title: "Not valid", subtitle: e instanceof Error ? e.message : undefined });
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await verifyRedemption({ code });
      setPreview(null);
      setResult({ ok: true, title: r.detail?.title ?? "Redeemed", subtitle: r.detail?.subtitle });
    } catch (e) {
      setPreview(null);
      setResult({ ok: false, title: "Not valid", subtitle: e instanceof Error ? e.message : undefined });
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <h3 className="font-display text-lg font-bold text-ink">Scan or enter a customer code</h3>
      <p className="mt-1 text-sm text-ink-muted">
        Passes, vouchers, loyalty rewards and offers. Nothing is used until you confirm.
      </p>

      {result ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-sand/40 p-4">
          <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg text-paper " + (result.ok ? "bg-emerald-600" : "bg-rose-600")}>{result.ok ? "✓" : "✕"}</span>
          <div className="min-w-0">
            <p className="font-display font-bold text-ink">{result.ok ? `${result.title} — redeemed` : result.title}</p>
            {result.subtitle && <p className="text-sm text-ink-muted">{result.subtitle}</p>}
          </div>
          <button onClick={reset} className="ml-auto shrink-0 rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">Next customer</button>
        </div>
      ) : preview ? (
        /* Nothing has been consumed at this point. */
        <div className="mt-4 rounded-xl border border-line bg-sand/40 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">About to redeem</p>
          <p className="mt-1 font-display text-lg font-bold text-ink">{preview.title}</p>
          {preview.subtitle && <p className="text-sm text-ink-muted">{preview.subtitle}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={confirm} disabled={busy}
              className="rounded-pill px-6 py-2.5 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40"
              style={{ background: accent }}>
              {busy ? "Redeeming…" : "Confirm redemption"}
            </button>
            <button onClick={reset} disabled={busy}
              className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
            onKeyDown={(e) => { if (e.key === "Enter") look(); }}
            placeholder="ABCD"
            aria-label="Customer redemption code"
            className="w-40 rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-center text-2xl font-black tracking-[0.3em] text-ink outline-none focus:border-local"
          />
          <button onClick={look} disabled={code.length !== 4 || busy}
            className="rounded-pill px-6 py-2.5 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40"
            style={{ background: accent }}>
            {busy ? "Looking…" : "Look up"}
          </button>
        </div>
      )}
    </div>
  );
}
