"use client";

import { useState } from "react";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { createBoostIntent, type BoostOption } from "@/lib/business-client";
import { useAttemptId } from "@/lib/use-attempt-id";
import { BIZ, type ManagedBusiness } from "@/lib/business-data";
import { gbp } from "@/lib/stripe";

/**
 * Buying a block of Pro.
 *
 * The three duration buttons used to read "1 wk / 2 wk / 3 wk" and charge on
 * the press — no price anywhere on the screen, no confirmation. So this exists
 * for the same reason the membership checkout does: show what it costs and
 * what it buys, and charge only when someone presses a button with the amount
 * written on it.
 *
 * Opening it charges nothing. Choosing a card charges nothing.
 */
export function BoostCheckout({
  business, option, hasSavedCard, currentUntil, onClose, onPaid,
}: {
  business: ManagedBusiness;
  option: BoostOption;
  hasSavedCard: boolean;
  currentUntil: string | null;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState<"saved" | "new">(hasSavedCard ? "saved" : "new");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One reference per deliberate checkout, held across a retry and any SCA
  // challenge. A later extension of the same duration opens a new checkout and
  // therefore gets a new one.
  const attemptId = useAttemptId(option.weeks);

  const extending = !!currentUntil && new Date(currentUntil) > new Date();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const usingSavedCard = method === "saved";
      const res = await createBoostIntent(business.id, option.weeks, attemptId(), usingSavedCard);
      if (res.charged) { onPaid(); return; }
      // Choosing the saved card is a decision about WHICH card. A saved-card
      // charge that does not complete is an error to show, never a reason to
      // put a card form in front of someone who did not ask for one.
      if (!usingSavedCard && res.paymentIntent) { setClientSecret(res.paymentIntent); return; }
      if (usingSavedCard) throw new Error("That card couldn't complete the payment. Try again, or choose another card.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not take the payment.");
    } finally {
      setBusy(false);
    }
  }

  const card = "rounded-card border border-line bg-paper p-5 shadow-soft";

  if (clientSecret) {
    return (
      <div className={card}>
        <p className="mb-3 font-display text-lg font-bold text-ink">
          {option.weeks} week{option.weeks > 1 ? "s" : ""} of Pro · {gbp(option.amountPence)}
        </p>
        <PaymentCheckout
          clientSecret={clientSecret}
          amountPence={option.amountPence}
          accent={BIZ}
          payLabel={`Pay ${gbp(option.amountPence)}`}
          onPaid={onPaid}
          onCancel={() => setClientSecret(null)}
        />
      </div>
    );
  }

  return (
    <div className={card}>
      <h3 className="font-display text-xl font-bold text-ink">Boost {business.name} to Pro</h3>
      <p className="mt-0.5 text-sm text-ink-soft">
        {option.weeks} week{option.weeks > 1 ? "s" : ""} of Pro · one-off payment, no subscription.
      </p>

      <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Boost price</dt>
          <dd className="font-semibold text-ink">{gbp(option.amountPence)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2">
          <dt className="font-display font-bold text-ink">Total today</dt>
          <dd className="font-display text-lg font-bold text-ink">{gbp(option.amountPence)}</dd>
        </div>
      </dl>

      <div className="mt-3 rounded-xl bg-sand px-4 py-3 text-sm">
        {extending ? (
          <>
            <p className="text-ink-soft">Pro access until {fmt(currentUntil!)}</p>
            <p className="font-semibold text-ink">Extends to {fmt(option.newExpiry)}</p>
          </>
        ) : (
          <p className="font-semibold text-ink">Pro until {fmt(option.newExpiry)}</p>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-ink">Pay with</p>
        <div className="space-y-2">
          {hasSavedCard && (
            <MethodRow selected={method === "saved"} onSelect={() => setMethod("saved")}
              title="Your saved card" sub="The card on this business or your account" />
          )}
          <MethodRow selected={method === "new"} onSelect={() => setMethod("new")}
            title={hasSavedCard ? "Use another card" : "Pay by card"} sub="Enter card details at the next step" />
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <button
        onClick={pay}
        disabled={busy}
        className="mt-4 w-full rounded-pill px-5 py-3 font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
        style={{ background: BIZ }}
      >
        {busy ? "Please wait…" : `Pay ${gbp(option.amountPence)}`}
      </button>
      <button onClick={onClose} disabled={busy} className="mt-2 w-full py-2 text-sm font-semibold text-ink-muted hover:text-ink">
        Cancel
      </button>
    </div>
  );
}

function MethodRow({ selected, onSelect, title, sub }: {
  selected: boolean; onSelect: () => void; title: string; sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={"flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition " +
        (selected ? "border-current" : "border-line hover:border-line-strong")}
      style={selected ? { color: BIZ, background: `${BIZ}0d` } : undefined}
    >
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2"
        style={{ borderColor: selected ? BIZ : "#cbd5e1" }}>
        {selected && <span className="h-2 w-2 rounded-full" style={{ background: BIZ }} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-muted">{sub}</span>
      </span>
    </button>
  );
}
