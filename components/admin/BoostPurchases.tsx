"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { gbp } from "@/lib/stripe";
import type { AdminBoostPurchase } from "@/lib/admin-data.server";

/**
 * Business boosts, and the refund control for them.
 *
 * A boost is OneShetland platform revenue — no Connect transfer, no
 * application fee, no business payout — so only a platform admin refunds one.
 * The server enforces that; this screen is how a person finds the right
 * purchase and says what they want to happen.
 *
 * No Stripe identifier is rendered, and none is sent: the refund is addressed
 * by the purchase's own id and the payment reference is looked up server-side.
 */

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const remainingOf = (p: AdminBoostPurchase) => Math.max(0, p.amount_pence - (p.refunded_pence ?? 0));

const STATE: Record<string, { label: string; tone: "green" | "amber" | "purple" }> = {
  none:    { label: "Paid", tone: "green" },
  partial: { label: "Partly refunded", tone: "amber" },
  full:    { label: "Refunded", tone: "purple" },
};

export function BoostPurchases({ purchases }: { purchases: AdminBoostPurchase[] }) {
  const [target, setTarget] = useState<AdminBoostPurchase | null>(null);
  const paid = useMemo(() => purchases.filter((p) => p.status === "succeeded"), [purchases]);
  const total = paid.reduce((sum, p) => sum + p.amount_pence, 0);
  const returned = paid.reduce((sum, p) => sum + (p.refunded_pence ?? 0), 0);

  return (
    <>
      <section className="mt-10">
        <h2 className="mb-1 font-display text-xl font-bold text-ink">Business boosts</h2>
        <p className="mb-3 text-sm text-ink-soft">
          {paid.length} paid {paid.length === 1 ? "boost" : "boosts"} · {gbp(total)} to OneShetland
          {returned > 0 ? ` · ${gbp(returned)} returned` : ""}
        </p>

        {purchases.length === 0 ? (
          <Card><Empty>No boosts bought yet.</Empty></Card>
        ) : (
          <div className="space-y-2">
            {purchases.map((p) => {
              const st = STATE[p.refund_state] ?? STATE.none;
              const remaining = remainingOf(p);
              const refundable = p.status === "succeeded" && remaining > 0;
              // A fully refunded boost is not "Expired" — it stopped counting
              // because the money went back.
              const active = p.refund_state !== "full"
                && !!p.expires_at && new Date(p.expires_at) > new Date();
              return (
                <Card key={p.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-bold text-ink">{p.businessName}</p>
                      <p className="text-sm text-ink-soft">
                        {p.weeks} week{p.weeks > 1 ? "s" : ""} of Pro · bought by {p.ownerName}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {fmt(p.created_at)}
                        {p.expires_at && p.refund_state !== "full" ? ` · Pro until ${fmt(p.expires_at)}` : ""}
                      </p>
                      {(p.refunded_pence ?? 0) > 0 && (
                        <p className="text-xs font-semibold text-ink-soft">
                          {gbp(p.refunded_pence)} of {gbp(p.amount_pence)} returned
                          {remaining > 0 ? ` · ${gbp(remaining)} still refundable` : ""}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-bold text-ink">{gbp(p.amount_pence)}</p>
                      <div className="mt-1 flex justify-end">
                        {p.status !== "succeeded"
                          ? <StatusPill label="Pending" tone="amber" />
                          : <StatusPill label={p.refund_state === "none" && !active ? "Expired" : st.label}
                                        tone={p.refund_state === "none" && !active ? "gray" : st.tone} />}
                      </div>
                      {refundable && (
                        <button onClick={() => setTarget(p)}
                          className="mt-2 rounded-pill border border-line-strong px-4 py-1.5 text-xs font-semibold text-ink hover:bg-white">
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

/** The plain-English consequence, worked out by the server that will apply it. */
function consequenceSentence(c: { outcome: string; pro_until?: string } | null): string | null {
  if (!c) return null;
  switch (c.outcome) {
    case "returns_to_free":
      return "Pro will end and this business will return to Free.";
    case "falls_back":
      return `Pro will fall back to ${c.pro_until ? fmt(c.pro_until) : "an earlier date"}.`;
    case "subscription":
      return "No plan change — this business now has an active subscription.";
    case "not_boost_derived":
      return "No plan change — this business's plan was not set by this boost.";
    default:
      return "No plan change — this boost has already expired.";
  }
}

function RefundModal({ purchase, onClose }: { purchase: AdminBoostPurchase; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ pence: number | null; label: string } | null>(null);
  const [conseq, setConseq] = useState<{ outcome: string; pro_until?: string } | null>(null);

  const already = purchase.refunded_pence ?? 0;
  const remaining = remainingOf(purchase);
  const partial = Math.round(Number(amount) * 100);
  const partialValid = Number.isInteger(partial) && partial > 0 && partial <= remaining;

  /**
   * Asked for only when a FULL refund is being confirmed, because that is the
   * only case that can change entitlement. Computed by the database using the
   * same replay the write path uses, so the sentence on screen and the thing
   * that happens cannot disagree.
   */
  async function askConsequence() {
    try {
      const sb = createClient();
      const { data } = await sb.rpc("boost_refund_consequence", { p_purchase: purchase.id });
      setConseq((data as { outcome: string; pro_until?: string } | null) ?? null);
    } catch { setConseq(null); }
  }

  async function run(pence: number | null) {
    setBusy(true);
    setError(null);
    try {
      const sb = createClient();
      const { data, error: err } = await sb.functions.invoke("refund-payment", {
        // The purchase id, never a payment reference: the server resolves the
        // payment from our own ledger.
        body: pence == null
          ? { boost_purchase_id: purchase.id }
          : { boost_purchase_id: purchase.id, amount_pence: pence },
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
    <Modal open onClose={onClose} title="Refund business boost" accent="#6b47bf">
      <div className="space-y-4">
        <div>
          <p className="font-display text-lg font-bold text-ink">{purchase.businessName}</p>
          <p className="text-sm text-ink-soft">
            {purchase.weeks} week{purchase.weeks > 1 ? "s" : ""} of Pro · bought by {purchase.ownerName} · {fmt(purchase.created_at)}
          </p>
        </div>

        <dl className="space-y-1.5 rounded-card border border-line bg-sand/50 p-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">Original total</dt><dd className="font-semibold text-ink">{gbp(purchase.amount_pence)}</dd></div>
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
                ? `This returns the money to the business. ${consequenceSentence(conseq) ?? ""}`
                : "Returning part of this payment does not shorten the Pro access."}
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => { setConfirming(null); setConseq(null); }} disabled={busy}
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
          <div className="space-y-3">
            <button
              onClick={async () => { await askConsequence(); setConfirming({ pence: null, label: gbp(remaining) }); }}
              className="w-full rounded-pill bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">
              Refund the full {gbp(remaining)}
            </button>

            <div className="rounded-card border border-line p-3">
              <label className="text-sm font-semibold text-ink" htmlFor="boost-partial">Or refund part of it</label>
              <p className="mt-0.5 text-xs text-ink-muted">
                The business keeps the Pro time it bought. Only returning the whole amount ends it.
              </p>
              <div className="mt-2 flex gap-2">
                <input id="boost-partial" inputMode="decimal" value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="w-32 rounded-lg border border-line px-3 py-2 text-sm" />
                <button disabled={!partialValid}
                  onClick={() => setConfirming({ pence: partial, label: gbp(partial) })}
                  className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-white disabled:opacity-40">
                  Refund this amount
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
