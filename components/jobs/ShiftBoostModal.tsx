"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { fetchWalletBalance, walletCheckout } from "@/lib/local-commerce-client";
import {
  startShiftBoost,
  confirmShiftBoost,
  businessHasCard,
  NO_BUSINESS_CARD,
} from "@/lib/shift-boost-client";
import { gbp } from "@/lib/stripe";

const PRICE_PENCE = 299;

export function ShiftBoostModal({
  open,
  onClose,
  shiftId,
  shiftTitle,
  businessId,
  accent,
  onBoosted,
}: {
  open: boolean;
  onClose: () => void;
  shiftId: string;
  shiftTitle: string;
  businessId: string | null;
  accent: string;
  onBoosted: (boostedUntil: string) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"choose" | "pay" | "done">("choose");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [walletPence, setWalletPence] = useState<number | null>(null);
  const [hasBizCard, setHasBizCard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the modal (re)opens for a shift.
  useEffect(() => {
    if (!open) return;
    setStep("choose");
    setClientSecret(null);
    setError(null);
    setBusy(false);
    let live = true;
    fetchWalletBalance().then((p) => { if (live) setWalletPence(p); }).catch(() => {});
    if (businessId) {
      businessHasCard(businessId).then((h) => { if (live) setHasBizCard(h); }).catch(() => {});
    } else {
      setHasBizCard(false);
    }
    return () => { live = false; };
  }, [open, businessId, shiftId]);

  const canWallet = walletPence != null && walletPence >= PRICE_PENCE;

  async function finishBoost(pid?: string) {
    // confirm-boost now verifies the payment, so it needs the PaymentIntent id:
    // the off-session path passes it in; the card-form path derives it from the
    // clientSecret (`pi_XXX_secret_YYY` → `pi_XXX`).
    const paymentIntentId = pid ?? (clientSecret ? clientSecret.split("_secret")[0] : null);
    if (!paymentIntentId) { setError("Couldn't confirm the payment. Please try again."); return; }
    const res = await confirmShiftBoost(shiftId, paymentIntentId);
    onBoosted(res.boosted_until);
    setStep("done");
    router.refresh();
  }

  // Pay with a saved card (personal or business). Falls back to the card form
  // when no personal card is on file (mirrors the app's two-mode contract).
  async function payByCard(useBusinessCard: boolean) {
    setError(null);
    setBusy(true);
    try {
      const res = await startShiftBoost(shiftId, {
        useSavedCard: !useBusinessCard,
        useBusinessCard,
        businessId: businessId ?? undefined,
      });
      if ("charged" in res) {
        await finishBoost(res.payment_intent_id);
        return;
      }
      setClientSecret(res.clientSecret);
      setStep("pay");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start the boost.";
      if (msg === NO_BUSINESS_CARD) {
        setError("This business has no card on file. Add one in its dashboard, then try again.");
      } else if (/no saved card/i.test(msg)) {
        // Personal saved card missing → re-request the Elements card form.
        try {
          const res2 = await startShiftBoost(shiftId, {});
          if ("clientSecret" in res2) { setClientSecret(res2.clientSecret); setStep("pay"); return; }
        } catch (e2) {
          setError(e2 instanceof Error ? e2.message : msg);
        }
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function payFromWallet() {
    setError(null);
    setBusy(true);
    try {
      const res = await walletCheckout({ type: "shift_boost", shift_id: shiftId });
      if (typeof res.balance_pence === "number") setWalletPence(res.balance_pence);
      onBoosted(res.paid_until ?? new Date(Date.now() + 86_400_000).toISOString());
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pay from your wallet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Boost this shift" accent={accent}>
      {step === "done" ? (
        <div className="py-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: accent }}>⚡</span>
          <h3 className="mt-4 font-display text-2xl font-bold">Shift boosted!</h3>
          <p className="mt-2 text-ink-soft">Matching workers have been alerted. Your shift is pinned to the top for 24 hours.</p>
          <button onClick={onClose} className="mt-5 rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>Done</button>
        </div>
      ) : step === "pay" && clientSecret ? (
        <PaymentCheckout
          clientSecret={clientSecret}
          amountPence={PRICE_PENCE}
          accent={accent}
          payLabel={`Pay ${gbp(PRICE_PENCE)}`}
          onPaid={finishBoost}
          onCancel={() => { setClientSecret(null); setStep("choose"); }}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-paper p-4">
            <p className="font-display text-xl font-bold text-ink">{shiftTitle}</p>
            <p className="mt-1 text-sm text-ink-soft">
              Featured at the top and matching workers alerted for 24 hours, for {gbp(PRICE_PENCE)}.
            </p>
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

          {/* Business card — a boost is a business expense, so offer it first. */}
          {businessId && hasBizCard && (
            <button onClick={() => payByCard(true)} disabled={busy}
              className="w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50" style={{ background: accent }}>
              {busy ? "Please wait…" : `Pay ${gbp(PRICE_PENCE)} · business card`}
            </button>
          )}

          {/* Wallet — primary if business card unavailable and funds cover it. */}
          {canWallet && (
            <button onClick={payFromWallet} disabled={busy}
              className={businessId && hasBizCard
                ? "w-full rounded-pill border border-line-strong px-5 py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
                : "w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"}
              style={businessId && hasBizCard ? undefined : { background: accent }}>
              {busy ? "Please wait…" : `Pay from wallet · ${gbp(PRICE_PENCE)}`}
            </button>
          )}

          {/* Personal card — always available as a fallback (server shows the
              card form if no card is on file). */}
          <button onClick={() => payByCard(false)} disabled={busy}
            className={(businessId && hasBizCard) || canWallet
              ? "w-full rounded-pill border border-line-strong px-5 py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
              : "w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"}
            style={(businessId && hasBizCard) || canWallet ? undefined : { background: accent }}>
            {busy ? "Please wait…" : `Pay ${gbp(PRICE_PENCE)} · my card`}
          </button>

          {walletPence != null && walletPence < PRICE_PENCE && (
            <p className="text-center text-xs text-ink-muted">Wallet balance {gbp(walletPence)} — not enough to cover this.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
