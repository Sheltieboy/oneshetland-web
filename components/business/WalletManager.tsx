"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlanNote } from "@/components/business/CapabilityPaywall";
import { BIZ, type ManagedBusiness, type WalletReceipt } from "@/lib/business-data";
import { updateBusiness } from "@/lib/business-client";
import { createClient } from "@/lib/supabase/client";
import { useConfirm, useNotify } from "@/components/ui/ConfirmProvider";
import { requirePayoutReadyForPaidActivation, startOrResumePayoutSetup, classifyPayoutOnboardingError, payoutOnboardingErrorNotify, PAYOUT_NOT_READY_PROMPT } from "@/lib/payout-readiness";

const penceOrDash = (p: number | null) => (p == null ? "—" : `£${(p / 100).toFixed(2)}`);

export function WalletManager({ business, receipts, canEnable, payoutReady }: {
  business: ManagedBusiness; receipts: WalletReceipt[];
  /** Effective Pro. Settings, cashback and receipts do not depend on it, and
      switching acceptance OFF never does either. */
  canEnable: boolean;
  /**
   * From business_payout_ready() (see lib/business-data.server.ts), not
   * business.payout_enabled — that column only ever reflects this business's
   * OWN Connect account and says nothing about a valid owner-central-account
   * fallback, which is exactly how a genuinely payable business ended up
   * shown "Connect Stripe to accept wallet payments" here.
   */
  payoutReady: boolean;
}) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const notify = useNotify();
  const b = business;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<WalletReceipt | null>(null);

  /**
   * Full only. wallet_reverse_debit returns the whole original spend and records
   * exactly one reversal linked to it; a partial would have to be a loose credit
   * with no link back to what it reverses. Only the ledger row's id is sent —
   * business, customer, Stripe account and the purchase to void are all resolved
   * server-side.
   */
  async function refund(r: WalletReceipt) {
    setRefunding(r.id); setError(null);
    try {
      const sb = createClient();
      const { data, error: err } = await sb.functions.invoke("wallet-refund-business", {
        body: { transaction_id: r.id },
      });
      let msg = (data as { error?: string } | null)?.error ?? err?.message ?? null;
      if (msg && err) {
        try {
          const ctx = (err as { context?: { json?: () => Promise<{ error?: string }> } }).context;
          const body = await ctx?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* keep the generic message */ }
      }
      if (msg) { setError(msg); return; }
      setConfirm(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The refund could not be completed.");
    } finally {
      setRefunding(null);
    }
  }

  // Routes to whichever existing onboarding flow is actually this business's
  // payout destination — central or its own account, whichever
  // business_payout_ready uses — instead of always assuming its own
  // account. See startOrResumePayoutSetup's own doc comment.
  async function connectBank() {
    if (busy === "bank") return;
    setBusy("bank"); setError(null);
    let rateLimited: { error: unknown } | null = null;
    try {
      await startOrResumePayoutSetup(b.id);
      router.refresh();
    } catch (e) {
      // A rate-limited response never shows its raw text — a friendly
      // dialog instead; anything else keeps this page's existing banner.
      if (classifyPayoutOnboardingError(e) === "rate_limited") rateLimited = { error: e };
      else setError(e instanceof Error ? e.message : "Could not start Stripe.");
    } finally { setBusy(null); }
    if (rateLimited) await notify(payoutOnboardingErrorNotify(rateLimited.error));
  }

  async function setAccept(v: boolean) {
    // Fresh canonical check at the activation moment — the payoutReady prop
    // drives this card's display and can go stale between loads; this is the
    // actual gate and must not trust a cached value.
    if (v && !(await requirePayoutReadyForPaidActivation(b.id))) {
      if (await confirmDialog(PAYOUT_NOT_READY_PROMPT)) connectBank();
      return;
    }
    setBusy("accept"); try { await updateBusiness(b.id, { accepts_wallet: v }); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); } finally { setBusy(null); }
  }
  async function setCashback(p: number) { setBusy("cb"); try { await updateBusiness(b.id, { cashback_percent: p }); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); } finally { setBusy(null); } }

  const card = "rounded-card border border-line bg-paper p-5 shadow-soft";
  const weekNet = receipts.reduce((s, r) => s + (r.net_pence ?? r.gross_pence ?? 0), 0);

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink">Accept Local Wallet</h2>
          {payoutReady && (
            <button type="button" onClick={() => setAccept(!b.accepts_wallet)}
              disabled={busy === "accept" || (!canEnable && !b.accepts_wallet)}
              title={!canEnable && !b.accepts_wallet ? "Taking Wallet payments needs Pro" : undefined} className="relative inline-flex h-6 w-11 items-center rounded-full transition" style={{ background: b.accepts_wallet ? BIZ : "var(--color-line-strong)" }}>
              <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (b.accepts_wallet ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-muted">{payoutReady ? "Stripe connected · ready for payouts" : "Connect Stripe to accept wallet payments"}</p>
        {/* Named at the switch, not at the door. Cashback, receipts and the
            rest of this page are open to everybody, and switching acceptance
            OFF is always allowed — nobody gets trapped taking payments. */}
        {!canEnable && !b.accepts_wallet && (
          <PlanNote>Taking Wallet payments needs Pro. Your settings are saved.</PlanNote>
        )}
        {!payoutReady && (
          <button
            onClick={connectBank}
            disabled={busy === "bank"}
            aria-busy={busy === "bank"}
            className="mt-3 flex items-center gap-2 rounded-pill px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: BIZ }}
          >
            {busy === "bank" && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
            {busy === "bank" ? "Opening Stripe…" : "Connect Stripe"}
          </button>
        )}

        {payoutReady && b.accepts_wallet && (
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

      {payoutReady && b.accepts_wallet && (
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
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p className="font-bold text-ink">£{(r.gross_pence / 100).toFixed(2)} paid</p>
                      <p className="text-xs" style={{ color: BIZ }}>{penceOrDash(r.net_pence)} to you{r.cashback_pence ? ` · £${(r.cashback_pence / 100).toFixed(2)} cashback` : ""}</p>
                    </div>
                    {r.refund_state === "refunded" ? (
                      /* Kept in history — the money did arrive before it went back
                         — but stated, and unpressable. The Refund control used to
                         return after a reload and hand back a second "Refunded"
                         for a payment already returned. */
                      <span className="shrink-0 rounded-lg bg-sand px-2.5 py-1 text-xs font-semibold text-ink-muted">
                        Refunded
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setError(null); setConfirm(r); }}
                        disabled={refunding !== null}
                        className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
                      >
                        Refund
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {confirm && (
            <div className="mt-4 rounded-xl border border-line bg-paper p-4">
              <p className="font-display font-bold text-ink">Refund this payment?</p>
              <p className="mt-1 text-sm text-ink-soft">
                £{(confirm.gross_pence / 100).toFixed(2)} goes back to {confirm.customer_first_name ?? "the customer"},
                and {penceOrDash(confirm.net_pence)} comes back off your payout. Refunds are for the
                full amount and cannot be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => refund(confirm)}
                  disabled={refunding !== null}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: BIZ }}
                >
                  {refunding ? "Refunding…" : "Refund in full"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  disabled={refunding !== null}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-soft"
                >
                  Keep it
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
