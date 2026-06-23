import { loadStripe, type Stripe } from "@stripe/stripe-js";

/** Singleton Stripe.js loader (publishable key — safe in the browser). */
let promise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!promise) {
    promise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return promise;
}

/** Format pence as GBP, e.g. 2000 → "£20", 1550 → "£15.50". */
export function gbp(pence: number): string {
  const pounds = pence / 100;
  return `£${pounds.toFixed(2).replace(/\.00$/, "")}`;
}
