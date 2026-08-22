/**
 * checkout-errors.ts — what a buyer is told when a checkout fails.
 *
 * The ticket modal used to show whatever came back, which meant every failure
 * read "Something went wrong. Please try again." — because that is the fixed
 * sentence the backend's catch-all returns for any unexpected exception. The
 * real fix was at the source: a Stripe refusal is now a known outcome with a
 * `reason`, not an unexpected exception.
 *
 * This maps the few remaining cases the backend cannot phrase for a buyer, and
 * otherwise trusts the backend's own wording, which is already written for one.
 * An unknown internal failure stays generic on purpose — a buyer cannot act on
 * a stack trace and should not be shown one.
 */

/** Backend `reason` slugs, from supabase/functions/_shared/stripe-errors.ts. */
export type CheckoutReason =
  | "card_declined" | "card_expired" | "insufficient_funds"
  | "authentication_required" | "organiser_payout" | "amount_invalid"
  | "payment_failed";

const GENERIC = "Something went wrong. Please try again.";

/**
 * Wording for a message the backend produced that is not written for a buyer.
 * Keyed on the exact text so a rename upstream shows up here rather than
 * silently falling through to the generic line.
 */
const REPHRASE: Record<string, string> = {
  // Should be unreachable now the clients always send a reference — but if it
  // ever surfaces, no buyer should be shown implementation vocabulary.
  "Invalid checkout reference":
    "We couldn’t start this checkout. Please close this ticket window and try again.",
};

export function describeCheckoutError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (!msg) return GENERIC;
  if (REPHRASE[msg]) return REPHRASE[msg];
  // The backend's own safe messages ("That card was declined…", "This organiser
  // isn't able to receive payments yet…") are already buyer-facing. Show them.
  return msg;
}
