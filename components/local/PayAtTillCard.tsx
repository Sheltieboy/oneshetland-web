"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { gbp } from "@/lib/stripe";
import { payWithWallet } from "@/lib/local-commerce-client";

const LOCAL = "#7c3aed";

/**
 * PayAtTillCard — web mirror of the app's "Pay at till" flow (local-pay.tsx).
 *
 * IMPORTANT — the OneShetland pay model is *merchant-displays-code*, not
 * *customer-shows-QR*: the business shows a rotating 6-digit till code and the
 * customer enters it (the `local-wallet-pay` edge fn identifies the customer from
 * their JWT). There is therefore no customer-side payload for a merchant to scan.
 *
 * So this card does two things, mirroring the app faithfully:
 *   1. A QR that deep-links to the app's pay screen (oneshetland://local-pay) — a
 *      convenience hand-off to finish on the phone, NOT a merchant-scannable code.
 *   2. The real web pay flow: enter amount + the business's till code → pay.
 */
export function PayAtTillCard({
  balancePence,
  onPaid,
}: {
  balancePence: number | null;
  onPaid?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ balance_pence: number; cashback_pence: number } | null>(null);

  const amountPence = Math.round((parseFloat(amount) || 0) * 100);
  const balance = balancePence ?? 0;
  const amountValid = amountPence >= 50 && amountPence <= balance;
  const codeValid = /^\d{6}$/.test(code);

  async function pay() {
    if (!amountValid || !codeValid || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await payWithWallet(code, amountPence);
      setDone(res);
      setAmount("");
      setCode("");
      onPaid?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pay. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint";
  const lab = "mb-1 block text-sm font-semibold text-ink-soft";

  return (
    <section className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <h2 className="font-display text-xl font-bold text-ink">Pay at till</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Pay from your wallet at a participating business. Ask staff for their till code, enter it with the
        amount, and we&apos;ll charge your balance.
      </p>

      <div className="mt-5 grid gap-6 sm:grid-cols-[auto,1fr] sm:items-start">
        {/* QR — hand-off to the app to finish on a phone. */}
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-card border border-line bg-white p-3">
            <QRCodeSVG value="oneshetland://local-pay" size={132} fgColor={LOCAL} level="M" />
          </div>
          <p className="max-w-[150px] text-center text-xs text-ink-faint">
            Scan with your phone to finish paying in the app
          </p>
        </div>

        {/* Web pay flow. */}
        {done ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-display font-bold text-emerald-700">Paid ✓</p>
            <p className="mt-1 text-sm text-emerald-800">New balance: {gbp(done.balance_pence)}</p>
            {done.cashback_pence > 0 && (
              <p className="mt-0.5 text-sm text-emerald-800">
                Earned {gbp(done.cashback_pence)} cashback
              </p>
            )}
            <button
              onClick={() => setDone(null)}
              className="mt-3 rounded-pill px-4 py-2 text-sm font-semibold text-white"
              style={{ background: LOCAL }}
            >
              Pay again
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={lab}>Amount</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">£</span>
                <input
                  className={field + " pl-7"}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                Balance: <span className="font-semibold">{balancePence === null ? "…" : gbp(balance)}</span>
              </p>
              {amount && amountPence < 50 && (
                <p className="mt-1 text-xs text-rose-600">Minimum payment is £0.50</p>
              )}
              {amount && amountPence > balance && (
                <p className="mt-1 text-xs text-rose-600">Not enough credit — top up first.</p>
              )}
            </div>

            <div>
              <label className={lab}>Business till code</label>
              <input
                className={field + " font-mono tracking-[0.3em] tabular-nums"}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <p className="mt-1 text-xs text-ink-faint">The 6-digit code shown on the shop&apos;s till — it refreshes often.</p>
            </div>

            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

            <button
              onClick={pay}
              disabled={!amountValid || !codeValid || busy}
              className="w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
              style={{ background: LOCAL }}
            >
              {busy ? "Paying…" : amountValid ? `Pay ${gbp(amountPence)}` : "Pay"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
