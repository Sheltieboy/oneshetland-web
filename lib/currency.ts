/**
 * currency.ts — money as text. Nothing else.
 *
 * `gbp` used to live in lib/stripe.ts, and that one line of convenience loaded
 * Stripe.js on every page of the site. `@stripe/stripe-js` inserts its script
 * tag "as a side effect immediately upon importing this module" (Stripe's own
 * README), so any module that reached lib/stripe for a formatter dragged
 * js.stripe.com — and its __stripe_mid / __stripe_sid cookies — onto pages with
 * no payment on them at all. The global ChargeApprovalListener did exactly that,
 * which put those cookies on the homepage, the Directory and What's On.
 *
 * So this file has no imports and never will. A formatter has no business
 * deciding what the browser loads.
 *
 * Stripe still loads where a payment genuinely happens: getStripe() is
 * untouched, and its fraud signals are untouched with it.
 */

/** Format pence as GBP, e.g. 2000 → "£20", 1550 → "£15.50". */
export function gbp(pence: number): string {
  const pounds = pence / 100;
  return `£${pounds.toFixed(2).replace(/\.00$/, "")}`;
}
