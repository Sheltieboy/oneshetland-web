import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Importing this module loads Stripe.js — `@stripe/stripe-js` inserts its
 * script tag "as a side effect immediately upon importing this module", which
 * is how Stripe collects the fraud signals it wants while a customer browses.
 *
 * That is correct on a payment surface and wrong everywhere else, so NOTHING
 * that is not about taking a payment may import this file. The currency
 * formatter that used to live here now lives in lib/currency.ts, because it was
 * pulling Stripe.js onto the homepage through a global component.
 */

/** Singleton Stripe.js loader (publishable key — safe in the browser). */
let promise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!promise) {
    promise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return promise;
}
