"use client";

import { useState } from "react";
import Link from "next/link";
import { gbp } from "@/lib/stripe";
import { payWithWallet } from "@/lib/local-commerce-client";
import { useAttemptId } from "@/lib/use-attempt-id";

const LOCAL = "#7c3aed";

/**
 * PayAtTillCard — web mirror of the app's "Pay at till" flow (local-pay.tsx).
 *
 * IMPORTANT — this is the *fallback*, not the main road. The customer shows
 * their member card and staff scan it; that card is the one code anybody should
 * ever be asked to present. This flow is for when staff can't scan.
 *
 * The pay model here is *merchant-displays-code*: the business shows a rotating
 * 6-digit till code and the customer enters it (the `local-wallet-pay` edge fn
 * identifies the customer from their JWT). There is no customer-side payload for
 * a merchant to scan, which is exactly why the app-handoff QR that used to sit
 * on this card was removed — staff read it as scannable and scanned it instead
 * of the member card, and every one of those scans failed.
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
  // A different amount or a different till code is a different payment.
  const attemptId = useAttemptId(`${code}|${amount}`);

  const amountPence = Math.round((parseFloat(amount) || 0) * 100);
  const balance = balancePence ?? 0;
  const amountValid = amountPence >= 50 && amountPence <= balance;
  const codeValid = /^\d{6}$/.test(code);

  async function pay() {
    if (!amountValid || !codeValid || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await payWithWallet(code, amountPence, attemptId());
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
      <h2 className="font-display text-xl font-bold text-ink">Enter a till code</h2>
      <p className="mt-1 text-sm text-ink-muted">
        The usual way to pay is to show your{" "}
        <Link href="/account/loyalty" className="font-semibold underline" style={{ color: LOCAL }}>
          member card
        </Link>{" "}
        and let staff scan it. Use this instead when they can&apos;t scan: ask for their till code, enter it
        with the amount, and we&apos;ll charge your balance.
      </p>

      {/* There used to be a second QR here — an app hand-off link that looked
          exactly like something staff should scan. It sent people to the till
          with the wrong code and cost a real afternoon of debugging. The member
          card is the only code a customer should ever be asked to present. */}

      <div className="mt-5">
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
