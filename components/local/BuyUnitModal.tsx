"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { startUnitPurchase, confirmUnitPurchase, fetchWalletBalance, walletCheckout } from "@/lib/local-commerce-client";
import { gbp } from "@/lib/stripe";
import { type UnitItem } from "@/lib/local-data";

type Confirm = { ok: boolean; purchase_id: string; uses_remaining: number; expires_at: string | null };

export function BuyUnitModal({
  open,
  onClose,
  item,
  accent,
  isLoggedIn,
  signInHref,
}: {
  open: boolean;
  onClose: () => void;
  item: UnitItem;
  accent: string;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [piId, setPiId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [walletPence, setWalletPence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    let live = true;
    fetchWalletBalance().then((p) => { if (live) setWalletPence(p); }).catch(() => {});
    return () => { live = false; };
  }, [open, isLoggedIn]);

  const canWallet = walletPence != null && walletPence >= item.price_pence && item.price_pence > 0;

  async function proceed() {
    setError(null);
    setBusy(true);
    try {
      const res = await startUnitPurchase(item.id, true);   // use the buyer's saved card (server shows the card form if none)
      if ("charged" in res) {
        const c = await confirmUnitPurchase(item.id, res.payment_intent_id);
        setConfirm(c);
        setStep("done");
        router.refresh();
        return;
      }
      setClientSecret(res.clientSecret);
      setPiId(res.payment_intent_id);
      setStep("pay");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the purchase.");
    } finally {
      setBusy(false);
    }
  }

  async function payFromWallet() {
    setError(null);
    setBusy(true);
    try {
      const res = await walletCheckout({ type: "unit_purchase", unit_item_id: item.id });
      setConfirm({ ok: res.ok, purchase_id: res.purchase_id ?? "", uses_remaining: res.uses_remaining ?? 0, expires_at: res.expires_at ?? null });
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pay from your wallet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Buy ${item.name}`} accent={accent}>
      {!isLoggedIn ? (
        <div>
          <p className="text-ink-soft">Please sign in to buy — it keeps your passes and purchases in one place.</p>
          <Link href={signInHref} className="mt-4 inline-block rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>
            Sign in
          </Link>
        </div>
      ) : step === "done" ? (
        <div className="py-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: accent }}>✓</span>
          <h3 className="mt-4 font-display text-2xl font-bold">Purchased!</h3>
          {confirm && (
            <p className="mt-2 text-ink-soft">
              {confirm.uses_remaining} {confirm.uses_remaining === 1 ? "use" : "uses"} available
              {confirm.expires_at ? ` · valid until ${new Date(confirm.expires_at).toLocaleDateString("en-GB")}` : ""}.
            </p>
          )}
          <button onClick={onClose} className="mt-5 rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>Done</button>
        </div>
      ) : step === "pay" && clientSecret && piId ? (
        <PaymentCheckout
          clientSecret={clientSecret}
          amountPence={item.price_pence}
          accent={accent}
          payLabel={`Pay ${gbp(item.price_pence)}`}
          onPaid={async () => {
            const c = await confirmUnitPurchase(item.id, piId);
            setConfirm(c);
            setStep("done");
            router.refresh();
          }}
          onCancel={() => setStep("form")}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-paper p-4">
            <p className="font-display text-xl font-bold text-ink">{item.name}</p>
            {item.description && <p className="mt-1 text-sm text-ink-soft">{item.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
              <span className="font-bold text-ink">{gbp(item.price_pence)}</span>
              {item.uses_per_purchase > 1 && <span>· {item.uses_per_purchase} uses</span>}
              {item.valid_days && <span>· valid for {item.valid_days} days</span>}
            </div>
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

          {canWallet && (
            <button onClick={payFromWallet} disabled={busy}
              className="w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50" style={{ background: accent }}>
              {busy ? "Please wait…" : `Pay from wallet · ${gbp(item.price_pence)}`}
            </button>
          )}
          <button onClick={proceed} disabled={busy}
            className={canWallet
              ? "w-full rounded-pill border border-line-strong px-5 py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
              : "w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"}
            style={canWallet ? undefined : { background: accent }}>
            {busy ? "Please wait…" : canWallet ? `Pay by card · ${gbp(item.price_pence)}` : `Buy · ${gbp(item.price_pence)}`}
          </button>
          {walletPence != null && walletPence < item.price_pence && (
            <p className="text-center text-xs text-ink-muted">Wallet balance {gbp(walletPence)} — not enough to cover this.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
