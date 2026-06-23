"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe, gbp } from "@/lib/stripe";

/**
 * Reusable Stripe checkout. Give it a PaymentIntent `clientSecret` (from one of
 * the create-*-intent edge functions); it renders the PaymentElement, confirms
 * the card client-side, then calls `onPaid()` so the caller can run the matching
 * confirm-* edge function. Used by hub memberships and donations.
 */
export function PaymentCheckout({
  clientSecret,
  amountPence,
  accent = "#032f4c",
  payLabel,
  onPaid,
  onCancel,
}: {
  clientSecret: string;
  amountPence: number;
  accent?: string;
  payLabel?: string;
  onPaid: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: accent, borderRadius: "12px", fontFamily: "inherit" },
        },
      }}
    >
      <CheckoutForm
        amountPence={amountPence}
        accent={accent}
        payLabel={payLabel}
        onPaid={onPaid}
        onCancel={onCancel}
      />
    </Elements>
  );
}

function CheckoutForm({
  amountPence,
  accent,
  payLabel,
  onPaid,
  onCancel,
}: {
  amountPence: number;
  accent: string;
  payLabel?: string;
  onPaid: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setBusy(false);
      setError(submitErr.message ?? "Please check your card details.");
      return;
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setBusy(false);
      setError(error.message ?? "Payment could not be completed.");
      return;
    }

    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      await onPaid();
      return; // leave the button spinning — caller navigates / swaps UI
    }

    setBusy(false);
    setError("Payment was not completed. Please try again.");
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!stripe || busy}
          className="flex-1 rounded-pill px-5 py-3 font-semibold text-paper shadow-soft transition hover:brightness-95 disabled:opacity-50"
          style={{ background: accent }}
        >
          {busy ? "Processing…" : (payLabel ?? `Pay ${gbp(amountPence)}`)}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-pill border border-line-strong px-5 py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
      <p className="text-center text-xs text-ink-muted">
        Payments are processed securely by Stripe.
      </p>
    </form>
  );
}
