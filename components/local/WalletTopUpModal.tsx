"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { startWalletTopUp, confirmWalletTopUp } from "@/lib/local-commerce-client";
import { gbp } from "@/lib/stripe";

const PRESETS = [1000, 2000, 5000, 10000];

// Mirrors the bounds enforced server-side by local-wallet-topup-intent (£5–£500).
const MIN_PENCE = 500;
const MAX_PENCE = 50_000;

export function WalletTopUpModal({
  open,
  onClose,
  accent,
  isLoggedIn,
  signInHref,
  currentBalancePence,
}: {
  open: boolean;
  onClose: () => void;
  accent: string;
  isLoggedIn: boolean;
  signInHref: string;
  currentBalancePence?: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(2000);
  const [customAmount, setCustomAmount] = useState("");
  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [piId, setPiId] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function proceed() {
    setError(null);
    if (amount < MIN_PENCE || amount > MAX_PENCE) {
      setError(`Amount must be between ${gbp(MIN_PENCE)} and ${gbp(MAX_PENCE)}.`);
      return;
    }
    setBusy(true);
    try {
      const res = await startWalletTopUp(amount, true);   // use the saved card (server shows the card form if none)
      if ("charged" in res) {
        const r = await confirmWalletTopUp(res.payment_intent_id);
        setNewBalance(r.balance_pence);
        setStep("done");
        router.refresh();
        return;
      }
      setClientSecret(res.clientSecret);
      setPiId(res.payment_intent_id);
      setStep("pay");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the top up.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Top up your wallet" accent={accent}>
      {!isLoggedIn ? (
        <div>
          <p className="text-ink-soft">Please sign in to top up your wallet — it keeps your balance in one place.</p>
          <Link href={signInHref} className="mt-4 inline-block rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>
            Sign in
          </Link>
        </div>
      ) : step === "done" ? (
        <div className="py-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: accent }}>✓</span>
          <h3 className="mt-4 font-display text-2xl font-bold">Wallet topped up!</h3>
          {newBalance != null && <p className="mt-2 text-ink-soft">New balance: {gbp(newBalance)}</p>}
          <button onClick={onClose} className="mt-5 rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>Done</button>
        </div>
      ) : step === "pay" && clientSecret && piId ? (
        <PaymentCheckout
          clientSecret={clientSecret}
          amountPence={amount}
          accent={accent}
          payLabel={`Pay ${gbp(amount)}`}
          onPaid={async () => {
            const r = await confirmWalletTopUp(piId);
            setNewBalance(r.balance_pence);
            setStep("done");
            router.refresh();
          }}
          onCancel={() => setStep("form")}
        />
      ) : (
        <div className="space-y-4">
          {currentBalancePence != null && (
            <p className="text-sm font-semibold text-ink-soft">Current balance: {gbp(currentBalancePence)}</p>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Amount</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => { setAmount(p); setCustomAmount(""); setError(null); }}
                  aria-label={`Top up ${gbp(p)}`}
                  aria-pressed={amount === p && customAmount === ""}
                  className={"rounded-xl border px-2 py-2.5 text-sm font-bold transition " + (amount === p && customAmount === "" ? "text-paper" : "border-line bg-paper text-ink hover:border-current")}
                  style={amount === p && customAmount === "" ? { background: accent, borderColor: accent } : { color: accent }}>
                  {gbp(p)}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="mt-2">
              <label htmlFor="wallet-custom-amount" className="mb-1 block text-xs font-semibold text-ink-soft">
                Or enter your own amount
              </label>
              <div className="flex items-center rounded-xl border border-line bg-paper px-3 focus-within:border-current" style={{ color: accent }}>
                <span className="text-sm font-bold text-ink" aria-hidden="true">£</span>
                <input
                  id="wallet-custom-amount"
                  type="text"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomAmount(v);
                    setError(null);
                    const pounds = parseFloat(v.replace(/[^0-9.]/g, ""));
                    if (!isNaN(pounds)) setAmount(Math.round(pounds * 100));
                  }}
                  placeholder="Other amount"
                  aria-label="Custom top-up amount in pounds"
                  className="w-full bg-transparent px-2 py-2.5 text-sm font-bold text-ink outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-ink-faint">Min {gbp(MIN_PENCE)}, max {gbp(MAX_PENCE)}.</p>
            </div>
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

          <button onClick={proceed} disabled={busy}
            className="w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50" style={{ background: accent }}>
            {busy ? "Please wait…" : `Top up · ${gbp(amount)}`}
          </button>
        </div>
      )}
    </Modal>
  );
}
