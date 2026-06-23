"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ, type ManagedBusiness, type WalletReceipt } from "@/lib/business-data";
import { updateBusiness, createBusinessOnboardingLink } from "@/lib/business-client";

const penceOrDash = (p: number | null) => (p == null ? "—" : `£${(p / 100).toFixed(2)}`);

export function WalletManager({ business, receipts }: { business: ManagedBusiness; receipts: WalletReceipt[] }) {
  const router = useRouter();
  const b = business;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function connectBank() {
    setBusy("bank"); setError(null);
    const w = 680, h = 720;
    const popup = window.open("about:blank", "stripe-connect", `width=${w},height=${h},left=${(window.screen.width - w) / 2},top=${(window.screen.height - h) / 2},scrollbars=yes`);
    try {
      const { url } = await createBusinessOnboardingLink(b.id);
      if (popup && !popup.closed) { popup.location.href = url; pollRef.current = setInterval(() => { if (popup.closed) { clearInterval(pollRef.current!); router.refresh(); } }, 700); }
      else window.location.href = url;
    } catch (e) { popup?.close(); setError(e instanceof Error ? e.message : "Could not start Stripe."); } finally { setBusy(null); }
  }

  async function setAccept(v: boolean) { setBusy("accept"); try { await updateBusiness(b.id, { accepts_wallet: v }); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); } finally { setBusy(null); } }
  async function setCashback(p: number) { setBusy("cb"); try { await updateBusiness(b.id, { cashback_percent: p }); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); } finally { setBusy(null); } }

  const card = "rounded-card border border-line bg-paper p-5 shadow-soft";
  const weekNet = receipts.reduce((s, r) => s + (r.net_pence ?? r.gross_pence ?? 0), 0);

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink">Accept Local Wallet</h2>
          {b.payout_enabled && (
            <button type="button" onClick={() => setAccept(!b.accepts_wallet)} disabled={busy === "accept"} className="relative inline-flex h-6 w-11 items-center rounded-full transition" style={{ background: b.accepts_wallet ? BIZ : "var(--color-line-strong)" }}>
              <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (b.accepts_wallet ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-muted">{b.payout_enabled ? "Stripe connected · ready for payouts" : "Connect Stripe to accept wallet payments"}</p>
        {!b.payout_enabled && <button onClick={connectBank} disabled={busy === "bank"} className="mt-3 rounded-pill px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BIZ }}>{busy === "bank" ? "Opening Stripe…" : "Connect Stripe"}</button>}

        {b.payout_enabled && b.accepts_wallet && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-ink-soft">Cashback to customers</p>
            <div className="flex gap-2">
              {[0, 2, 5, 10].map((p) => (
                <button key={p} onClick={() => setCashback(p)} disabled={busy === "cb"} className={"flex-1 rounded-pill border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 " + (Number(b.cashback_percent) === p ? "text-white" : "border-line-strong text-ink-soft hover:bg-sand")} style={Number(b.cashback_percent) === p ? { background: BIZ, borderColor: BIZ } : undefined}>{p}%</button>
              ))}
            </div>
          </div>
        )}
      </section>

      {b.payout_enabled && b.accepts_wallet && (
        <section className={card}>
          <h2 className="font-display text-xl font-bold text-ink">Wallet payments received</h2>
          <p className="mt-1 text-sm text-ink-muted">{receipts.length ? `£${(weekNet / 100).toFixed(2)} recent · ${receipts.length} payment${receipts.length === 1 ? "" : "s"}` : "No wallet payments yet."}</p>
          {receipts.length > 0 && (
            <div className="mt-3 divide-y divide-line">
              {receipts.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-ink">{r.customer_first_name ?? "Customer"}</p>
                    <p className="text-xs text-ink-muted">{new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-bold text-ink">£{(r.gross_pence / 100).toFixed(2)} paid</p>
                    <p className="text-xs" style={{ color: BIZ }}>{penceOrDash(r.net_pence)} to you{r.cashback_pence ? ` · £${(r.cashback_pence / 100).toFixed(2)} cashback` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
