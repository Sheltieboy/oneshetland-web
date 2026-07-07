"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { startGift, confirmGift, fetchWalletBalance } from "@/lib/local-commerce-client";
import { gbp } from "@/lib/stripe";

type Confirmation = { ok: boolean; gift_id: string; code: string; claim_url?: string; email_sent?: boolean };

export function GiftModal({
  open,
  onClose,
  target,
  accent,
  isLoggedIn,
  signInHref,
}: {
  open: boolean;
  onClose: () => void;
  target: { kind: "unit" | "booking"; id: string; name: string; pricePence: number };
  accent: string;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const router = useRouter();
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [giftId, setGiftId] = useState<string | null>(null);
  const [piId, setPiId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [walletPence, setWalletPence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validEmail = /^\S+@\S+\.\S+$/.test(recipientEmail.trim());

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    let live = true;
    fetchWalletBalance().then((p) => { if (live) setWalletPence(p); }).catch(() => {});
    return () => { live = false; };
  }, [open, isLoggedIn]);

  const canWallet = walletPence != null && walletPence >= target.pricePence && target.pricePence > 0;

  async function proceed(viaWallet = false) {
    if (!validEmail) return setError("Please enter a valid recipient email.");
    setError(null);
    setBusy(true);
    try {
      const res = await startGift(
        {
          kind: target.kind === "unit" ? "unit" : "booking",
          unitItemId: target.kind === "unit" ? target.id : undefined,
          serviceId: target.kind === "booking" ? target.id : undefined,
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim() || null,
          message: message.trim() || null,
        },
        viaWallet ? { payWithWallet: true } : { useSavedCard: true },
      );
      if ("charged" in res) {
        const c = await confirmGift(res.gift_id, res.payment_intent_id);
        setConfirm(c);
        setStep("done");
        router.refresh();
        return;
      }
      setClientSecret(res.clientSecret);
      setGiftId(res.gift_id);
      setPiId(res.payment_intent_id);
      setStep("pay");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the gift.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Gift ${target.name}`} accent={accent}>
      {!isLoggedIn ? (
        <div>
          <p className="text-ink-soft">Please sign in to send a gift — it keeps your gifts and receipts in one place.</p>
          <Link href={signInHref} className="mt-4 inline-block rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>
            Sign in
          </Link>
        </div>
      ) : step === "done" && confirm ? (
        <div className="py-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: accent }}>✓</span>
          <h3 className="mt-4 font-display text-2xl font-bold">Gift sent!</h3>
          <div className="mx-auto mt-4 max-w-xs rounded-xl border border-line-strong bg-paper px-4 py-3 font-mono text-xl font-bold tracking-widest text-ink">
            {confirm.code}
          </div>
          <p className="mt-3 text-ink-soft">
            {confirm.email_sent
              ? `We've emailed it to ${recipientEmail.trim()}.`
              : "Share this code with them."}
          </p>
          {confirm.claim_url && (
            <p className="mt-1 text-xs text-ink-muted">They can redeem at {confirm.claim_url}</p>
          )}
          <button onClick={onClose} className="mt-5 rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>Done</button>
        </div>
      ) : step === "pay" && clientSecret && giftId && piId ? (
        <PaymentCheckout
          clientSecret={clientSecret}
          amountPence={target.pricePence}
          accent={accent}
          payLabel={`Pay ${gbp(target.pricePence)}`}
          onPaid={async () => {
            const c = await confirmGift(giftId, piId);
            setConfirm(c);
            setStep("done");
            router.refresh();
          }}
          onCancel={() => setStep("form")}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-paper p-4">
            <p className="text-sm text-ink-soft">You&apos;re gifting</p>
            <p className="mt-0.5 font-semibold text-ink">{target.name}</p>
            <p className="mt-1 font-display text-xl font-bold" style={{ color: accent }}>{gbp(target.pricePence)}</p>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">Recipient name (optional)</span>
            <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} maxLength={80} className="auth-input" placeholder="Who's it for?" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">Recipient email</span>
            <input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} type="email" inputMode="email" className="auth-input" placeholder="name@example.com" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">Message (optional)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={280} className="auth-input" placeholder="A wee note…" />
          </label>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

          {canWallet && (
            <button onClick={() => proceed(true)} disabled={busy || !validEmail}
              className="w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50" style={{ background: accent }}>
              {busy ? "Please wait…" : `Pay from wallet · ${gbp(target.pricePence)}`}
            </button>
          )}
          <button onClick={() => proceed(false)} disabled={busy || !validEmail}
            className={canWallet
              ? "w-full rounded-pill border border-line-strong px-5 py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
              : "w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"}
            style={canWallet ? undefined : { background: accent }}>
            {busy ? "Please wait…" : canWallet ? `Pay by card · ${gbp(target.pricePence)}` : `Continue · ${gbp(target.pricePence)}`}
          </button>
        </div>
      )}
    </Modal>
  );
}
