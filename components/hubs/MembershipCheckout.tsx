"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { getMembershipQuote, startMembershipPayment, confirmMembership, type MembershipQuote } from "@/lib/hubs-client";
import type { HubMembershipType } from "@/lib/hubs-data";
import { walletCheckout, fetchWalletBalance } from "@/lib/local-commerce-client";
import { useAttemptId } from "@/lib/use-attempt-id";
import { gbp } from "@/lib/stripe";

type Method = "saved" | "new" | "wallet";

const PERIOD_TERM: Record<string, string> = {
  year: "1 year",
  month: "1 month",
  once: "One-off — no expiry",
};

function addPeriod(from: Date, period: string): Date | null {
  const d = new Date(from);
  if (period === "year") { d.setFullYear(d.getFullYear() + 1); return d; }
  if (period === "month") { d.setMonth(d.getMonth() + 1); return d; }
  return null;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Membership checkout.
 *
 * The point of this component is the summary. A customer joined from a control
 * that said "Pay by card · £10/year" and was charged £10.95 — the fee was
 * right and nobody had shown it to them. So: face price, the OneShetland fee
 * and the total, from the server, before anything is committed.
 *
 * Opening it charges nothing. Choosing a method charges nothing. Only the
 * final Pay button does, and it carries the real figure.
 */
export function MembershipCheckout({
  open,
  onClose,
  tier,
  hubName,
  accent,
  hasSavedCard,
  currentPaidUntil,
  isRenewal,
}: {
  open: boolean;
  onClose: () => void;
  tier: HubMembershipType;
  hubName: string;
  accent: string;
  hasSavedCard: boolean;
  currentPaidUntil?: string | null;
  isRenewal?: boolean;
}) {
  const router = useRouter();
  const [quote, setQuote] = useState<MembershipQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<Method>(hasSavedCard ? "saved" : "new");
  const [walletPence, setWalletPence] = useState<number | null>(null);
  const [step, setStep] = useState<"review" | "card" | "done">("review");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [piId, setPiId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One reference per deliberate checkout. Bumped when the modal opens, so a
  // second deliberate purchase of the same tier is a new attempt — and NOT
  // bumped mid-flight, so a retry and an SCA challenge keep theirs.
  const [session, setSession] = useState(0);
  const attemptId = useAttemptId(session);

  useEffect(() => {
    if (!open) return;
    setStep("review");
    setClientSecret(null);
    setPiId(null);
    setError(null);
    setBusy(false);
    setMethod(hasSavedCard ? "saved" : "new");
    setSession((n) => n + 1);

    let live = true;
    setLoading(true);
    getMembershipQuote(tier.id)
      .then((q) => { if (live) setQuote(q); })
      .catch(() => { if (live) setError("Couldn't load the price. Please try again."); })
      .finally(() => { if (live) setLoading(false); });
    fetchWalletBalance().then((p) => { if (live) setWalletPence(p); }).catch(() => {});
    return () => { live = false; };
  }, [open, tier.id, hasSavedCard]);

  const total = quote?.total_pence ?? null;
  const walletCovers = walletPence != null && total != null && walletPence >= total;
  // Until the server has quoted, there is no honest amount to put on a button.
  const canPay = !busy && total != null && (method !== "wallet" || walletCovers);

  // Renewal adds a period to the EXISTING expiry, so say so rather than
  // implying a year from today.
  const base = isRenewal && currentPaidUntil && new Date(currentPaidUntil) > new Date()
    ? new Date(currentPaidUntil) : new Date();
  const newExpiry = quote ? addPeriod(base, quote.period) : null;

  async function pay() {
    if (total == null) return;
    setBusy(true);
    setError(null);
    try {
      if (method === "wallet") {
        await walletCheckout({ type: "hub_membership", membership_type_id: tier.id }, attemptId());
        setStep("done");
        router.refresh();
        return;
      }
      const res = await startMembershipPayment(tier.id, attemptId(), method === "saved");
      if (res.charged) {
        await confirmMembership(res.payment_intent_id);
        setStep("done");
        router.refresh();
        return;
      }
      if (res.clientSecret) {
        setClientSecret(res.clientSecret);
        setPiId(res.payment_intent_id);
        setStep("card");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not take the payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isRenewal ? "Renew membership" : `Join ${hubName}`} accent={accent}>
      {step === "done" ? (
        <div className="py-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: accent }}>✓</span>
          <h3 className="mt-4 font-display text-2xl font-bold">{isRenewal ? "Membership renewed" : "You're a member"}</h3>
          {newExpiry && <p className="mt-2 text-ink-soft">Valid until {fmt(newExpiry)}.</p>}
          <button onClick={onClose} className="mt-5 rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>Done</button>
        </div>
      ) : step === "card" && clientSecret && piId ? (
        <div className="space-y-3">
          {/* The total stays in view while they type their card. */}
          <div className="rounded-xl bg-sand px-4 py-3 text-sm font-semibold text-ink">
            {quote?.tier_name} · Total today {gbp(total ?? 0)}
          </div>
          <PaymentCheckout
            clientSecret={clientSecret}
            amountPence={total ?? 0}
            accent={accent}
            payLabel={`Pay ${gbp(total ?? 0)}`}
            onPaid={async () => {
              await confirmMembership(piId);
              setStep("done");
              router.refresh();
            }}
            onCancel={() => setStep("review")}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {loading ? (
            <p className="py-6 text-center text-ink-soft">Getting the price…</p>
          ) : !quote ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              This membership isn&apos;t available just now.
            </p>
          ) : (
            <>
              <div className="rounded-card border border-line bg-paper p-4">
                <p className="font-display text-xl font-bold text-ink">{quote.tier_name} membership</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {PERIOD_TERM[quote.period] ?? quote.period}
                  {newExpiry ? ` · valid until ${fmt(newExpiry)}` : ""}
                </p>

                <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Membership</dt>
                    <dd className="font-semibold text-ink">{gbp(quote.face_pence)}</dd>
                  </div>
                  {quote.fee_pence > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-ink-soft">OneShetland fee</dt>
                      <dd className="font-semibold text-ink">{gbp(quote.fee_pence)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-line pt-2">
                    <dt className="font-display font-bold text-ink">Total today</dt>
                    <dd className="font-display text-lg font-bold text-ink">{gbp(quote.total_pence)}</dd>
                  </div>
                </dl>
                {isRenewal && currentPaidUntil && new Date(currentPaidUntil) > new Date() && (
                  <p className="mt-3 text-xs text-ink-muted">
                    Added to your current membership — you keep the time you&apos;ve already paid for.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Pay with</p>
                <div className="space-y-2">
                  {hasSavedCard && (
                    <MethodRow selected={method === "saved"} onSelect={() => setMethod("saved")} accent={accent}
                      title="Your saved card" sub="The card on your OneShetland account" />
                  )}
                  <MethodRow selected={method === "new"} onSelect={() => setMethod("new")} accent={accent}
                    title={hasSavedCard ? "Use another card" : "Pay by card"} sub="Enter card details at the next step" />
                  <MethodRow
                    selected={method === "wallet"}
                    onSelect={() => setMethod("wallet")}
                    accent={accent}
                    disabled={walletPence != null && !walletCovers}
                    title="OneShetland Wallet"
                    sub={
                      walletPence == null ? "Checking your balance…"
                        : walletCovers ? `Balance ${gbp(walletPence)}`
                        : `Balance ${gbp(walletPence)} — not enough for ${gbp(total ?? 0)}`
                    }
                  />
                </div>
              </div>

              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

              <button
                onClick={pay}
                disabled={!canPay}
                className="w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"
                style={{ background: accent }}
              >
                {busy ? "Please wait…" : `Pay ${gbp(quote.total_pence)}`}
              </button>
              <p className="text-center text-xs text-ink-muted">
                Membership doesn&apos;t renew automatically — you choose when to renew.
              </p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function MethodRow({
  selected, onSelect, accent, title, sub, disabled,
}: {
  selected: boolean; onSelect: () => void; accent: string;
  title: string; sub: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition disabled:opacity-50 " +
        (selected ? "border-current" : "border-line hover:border-line-strong")
      }
      style={selected ? { color: accent, background: `${accent}0d` } : undefined}
    >
      <span
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2"
        style={{ borderColor: selected ? accent : "#cbd5e1" }}
      >
        {selected && <span className="h-2 w-2 rounded-full" style={{ background: accent }} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-muted">{sub}</span>
      </span>
    </button>
  );
}
