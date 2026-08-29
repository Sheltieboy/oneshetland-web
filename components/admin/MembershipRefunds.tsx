"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { gbp } from "@/lib/currency";
import type { AdminMembershipPurchase } from "@/lib/admin-data.server";

/**
 * Membership payments, and the refund control for them.
 *
 * Everything shown is read from our own ledger. Nothing here decides what may
 * be refunded: the amounts are re-derived by refund-payment, which re-reads the
 * purchase before it moves anything. This component's job is to let a person
 * find the right payment and say what they want to happen.
 *
 * No Stripe identifier is rendered. An administrator refunding a membership
 * needs to know who, which hub, which tier and how much — not a payment intent.
 */

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const totalOf = (p: AdminMembershipPurchase) => p.total_pence ?? p.face_pence + (p.fee_pence ?? 0);
const remainingOf = (p: AdminMembershipPurchase) => Math.max(0, totalOf(p) - (p.refunded_pence ?? 0));

const STATE: Record<string, { label: string; tone: "green" | "amber" | "purple" }> = {
  none:    { label: "Paid", tone: "green" },
  partial: { label: "Partly refunded", tone: "amber" },
  full:    { label: "Refunded", tone: "purple" },
};

export function MembershipRefunds({ purchases }: { purchases: AdminMembershipPurchase[] }) {
  const [target, setTarget] = useState<AdminMembershipPurchase | null>(null);
  const refundable = useMemo(() => purchases.filter((p) => remainingOf(p) > 0).length, [purchases]);

  return (
    <>
      <section className="mb-6">
        <h2 className="mb-1 font-display text-xl font-bold text-ink">Memberships</h2>
        <p className="mb-3 text-sm text-ink-soft">
          {purchases.length} membership {purchases.length === 1 ? "payment" : "payments"} · {refundable} still refundable
        </p>

        {purchases.length === 0 ? (
          <Card><Empty>No membership payments yet.</Empty></Card>
        ) : (
          <div className="space-y-2">
            {purchases.map((p) => {
              const st = STATE[p.refund_state] ?? STATE.none;
              const remaining = remainingOf(p);
              return (
                <Card key={p.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-bold text-ink">{p.customerName}</p>
                      <p className="text-sm text-ink-soft">{p.tier_name} · {p.hub_name}</p>
                      <p className="text-xs text-ink-muted">
                        {fmtDate(p.occurred_at)} · {p.payment_method === "wallet" ? "Wallet" : "Card"}
                      </p>
                      {p.refunded_pence > 0 && (
                        <p className="mt-1 text-sm font-semibold text-amber-700">
                          {gbp(p.refunded_pence)} refunded{p.refunded_at ? ` on ${fmtDate(p.refunded_at)}` : ""}
                          {remaining > 0 ? ` · ${gbp(remaining)} still refundable` : ""}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-bold text-ink">{gbp(totalOf(p))}</p>
                      <div className="mt-1 flex justify-end"><StatusPill label={st.label} tone={st.tone} /></div>
                      {remaining > 0 && p.payment_intent_id && (
                        <button
                          onClick={() => setTarget(p)}
                          className="mt-2 rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand"
                        >
                          Refund…
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {target && <RefundModal purchase={target} onClose={() => setTarget(null)} />}
    </>
  );
}

function RefundModal({ purchase, onClose }: { purchase: AdminMembershipPurchase; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ pence: number | null; label: string } | null>(null);

  const total = totalOf(purchase);
  const already = purchase.refunded_pence ?? 0;
  const remaining = remainingOf(purchase);
  // Wallet money goes back by reversing the original ledger entry, which has no
  // amount — so it is all or nothing. The server refuses a partial anyway; this
  // just says so before the click.
  const walletOnlyFull = purchase.payment_method === "wallet";

  const partial = Math.round(Number(amount) * 100);
  const partialValid = Number.isInteger(partial) && partial > 0 && partial <= remaining;

  async function run(pence: number | null) {
    setBusy(true);
    setError(null);
    try {
      const sb = createClient();
      const { data, error: err } = await sb.functions.invoke("refund-payment", {
        body: pence == null
          ? { payment_intent_id: purchase.payment_intent_id }
          : { payment_intent_id: purchase.payment_intent_id, amount_pence: pence },
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
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The refund could not be completed.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  return (
    <Modal open onClose={onClose} title="Refund membership" accent="#6b47bf">
      <div className="space-y-4">
        <div>
          <p className="font-display text-lg font-bold text-ink">{purchase.customerName}</p>
          <p className="text-sm text-ink-soft">
            {purchase.tier_name} · {purchase.hub_name} · {fmtDate(purchase.occurred_at)}
          </p>
        </div>

        <dl className="space-y-1.5 rounded-card border border-line bg-sand/50 p-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">Original total</dt><dd className="font-semibold text-ink">{gbp(total)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Already refunded</dt><dd className="font-semibold text-ink">{gbp(already)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2">
            <dt className="font-display font-bold text-ink">Remaining refundable</dt>
            <dd className="font-display text-lg font-bold text-ink">{gbp(remaining)}</dd>
          </div>
        </dl>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

        {confirming ? (
          <div className="rounded-card border border-rose-200 bg-rose-50 p-4">
            <p className="font-semibold text-rose-900">Refund {confirming.label}?</p>
            <p className="mt-1 text-sm text-rose-800">
              {confirming.pence == null
                ? "This returns the money to the customer, reverses the hub's payout and ends their membership unless another payment still covers it."
                : "This returns the money to the customer. Their membership is not affected."}
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setConfirming(null)} disabled={busy}
                className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-white disabled:opacity-50">
                Cancel
              </button>
              <button onClick={() => run(confirming.pence)} disabled={busy}
                className="rounded-pill bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                {busy ? "Refunding…" : `Yes, refund ${confirming.label}`}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => setConfirming({ pence: null, label: gbp(remaining) })}
              disabled={busy}
              className="w-full rounded-pill bg-navy px-5 py-3 font-semibold text-paper hover:bg-navy-dark disabled:opacity-50"
            >
              Refund {gbp(remaining)} in full
            </button>

            {walletOnlyFull ? (
              <p className="text-xs text-ink-muted">
                Wallet memberships can only be refunded in full — the money is returned by reversing the
                original wallet payment rather than issuing a separate credit.
              </p>
            ) : (
              <>
                <p className="text-center text-xs text-ink-muted">or refund part of it</p>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-ink">£</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={busy}
                    className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-ink"
                  />
                  <button
                    onClick={() => setConfirming({ pence: partial, label: gbp(partial) })}
                    disabled={!partialValid || busy}
                    className="shrink-0 rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40"
                  >
                    Refund
                  </button>
                </div>
                <p className="text-xs text-ink-muted">
                  A partial refund is recorded and shown to the member. It does not end their membership
                  or shorten it.
                </p>
              </>
            )}
          </>
        )}

        <button onClick={onClose} disabled={busy} className="w-full py-2 text-sm font-semibold text-ink-muted hover:text-ink">
          Close
        </button>
      </div>
    </Modal>
  );
}
