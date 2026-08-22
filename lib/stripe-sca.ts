/**
 * stripe-sca.ts — finishing a payment the issuer wants authenticated.
 *
 * The backend confirms saved-card PaymentIntents server-side. When the issuer
 * demands Strong Customer Authentication, Stripe answers `requires_action`
 * rather than `succeeded`: the payment is paused mid-flight, not failed.
 *
 * This completes THAT SAME PaymentIntent via stripe.handleNextAction, which is
 * Stripe's documented "finalizing payments on the server" flow. It never starts
 * a second PaymentIntent, so a 3D Secure challenge cannot become two
 * authorisations on the customer's card.
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

export interface PaymentStart {
  charged?: boolean;
  status?: "succeeded" | "requires_action" | "processing" | "failed";
  clientSecret?: string;
  payment_intent_id?: string;
  error?: string;
}

export type Settled =
  | { outcome: "succeeded" }
  | { outcome: "pending" }
  | { outcome: "cancelled" }
  | { outcome: "failed"; message: string };

let stripePromise: Promise<Stripe | null> | null = null;
function stripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");
  }
  return stripePromise;
}

/** Resolves a saved-card start, running the SCA challenge if the issuer asked for one. */
export async function settleSavedCardPayment(start: PaymentStart): Promise<Settled> {
  if (start?.charged || start?.status === "succeeded") return { outcome: "succeeded" };
  if (start?.status === "processing") return { outcome: "pending" };

  if (start?.status === "requires_action") {
    if (!start.clientSecret) {
      return { outcome: "failed", message: "Your bank asked to confirm this payment, but the confirmation could not be started. Please try again." };
    }
    const s = await stripe();
    if (!s) return { outcome: "failed", message: "Could not load the payment provider. Please try again." };

    const { error, paymentIntent } = await s.handleNextAction({ clientSecret: start.clientSecret });
    if (error) {
      return { outcome: "failed", message: error.message ?? "Your bank could not confirm this payment." };
    }
    if (paymentIntent?.status === "succeeded") return { outcome: "succeeded" };
    if (paymentIntent?.status === "processing") return { outcome: "pending" };
    // requires_payment_method after a challenge means the customer failed or
    // dismissed it. Not a completed purchase.
    return { outcome: "cancelled" };
  }

  if (start?.status === "failed") {
    return { outcome: "failed", message: start.error ?? "The payment could not be completed." };
  }

  return { outcome: "pending" };
}
