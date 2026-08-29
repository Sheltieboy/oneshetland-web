"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { gbp } from "@/lib/currency";
import type { HubLedgerEntry } from "@/lib/hubs-server";

/**
 * A hub owner refunding one of their own membership payments.
 *
 * Same backend as the platform-admin surface — refund-payment re-reads the
 * purchase, works out which hub it belongs to and refuses anyone who does not
 * own that hub. Nothing here decides authority or amounts; hiding the button
 * is a courtesy, not the boundary.
 *
 * No Stripe wording and no identifiers. An owner refunding a member needs to
 * know who, how much, and what it does to the membership.
 */

const totalOf = (p: HubLedgerEntry) => p.total_pence ?? p.face_pence + (p.fee_pence ?? 0);
const remainingOf = (p: HubLedgerEntry) => Math.max(0, totalOf(p) - (p.refunded_pence ?? 0));

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function MembershipRefundButton({ purchase, accent }: { purchase: HubLedgerEntry; accent: string }) {
  const [open, setOpen] = useState(false);
  if (remainingOf(purchase) <= 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink transition hover:bg-sand"
      >
        Refund…
      </button>
      {open && <RefundModal purchase={purchase} accent={accent} onClose={() => setOpen(false)} />}
    </>
  );
}

function RefundModal({ purchase, accent, onClose }: {
  purchase: HubLedgerEntry; accent: string; onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ pence: number | null; label: string } | null>(null);

  const total = totalOf(purchase);
  const already = purchase.refunded_pence ?? 0;
  const remaining = remainingOf(purchase);
  const who = purchase.memberName ?? "this member";
  // Wallet money goes back by reversing the original payment, which has no
  // amount, so it is all or nothing. The server refuses a partial regardless.
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
    <Modal open onClose={onClose} title="Refund membership" accent={accent}>
      <div className="space-y-4">
        <div>
          <p className="font-display text-lg font-bold text-ink">{who}</p>
          <p className="text-sm text-ink-soft">
            {purchase.tier_name} · bought {fmtDate(purchase.occurred_at)}
            {purchase.payment_method === "wallet" ? " · paid from wallet" : " · paid by card"}
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
            <p className="font-display font-bold text-rose-900">Refund {confirming.label}?</p>
            <p className="mt-1 text-sm text-rose-800">
              {confirming.pence == null
                ? `This returns ${confirming.label} to ${who} and ends this paid membership unless another paid period still covers it.`
                : `This returns ${confirming.label} to ${who}. Their membership is not affected.`}
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setConfirming(null)} disabled={busy}
                className="rounded-pill border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50">
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
              className="w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"
              style={{ background: accent }}
            >
              Refund {gbp(remaining)} in full
            </button>

            {walletOnlyFull ? (
              <p className="text-xs text-ink-muted">
                Memberships paid from a OneShetland wallet can only be refunded in full — the money is
                returned by reversing the original payment.
              </p>
            ) : (
              <>
                <p className="text-center text-xs text-ink-muted">or return part of it</p>
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
                  Returning part of a payment is recorded and shown to the member. Their membership
                  keeps running.
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
