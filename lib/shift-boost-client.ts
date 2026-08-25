"use client";

import { createClient } from "@/lib/supabase/client";
import { settleSavedCardPayment, type PaymentStart as ScaStart } from "./stripe-sca";

/* ── Boost a shift (£2.99, 24h featured) ───────────────────────────────────────
   Mirrors the app's two-step contract:

   create-boost-intent → { charged } (saved/business card, off-session) |
                         { clientSecret } (card form fallback, no saved card)
     Body: { shift_id, client_request_id, use_saved_card?, use_business_card?,
             business_id? }
     client_request_id is REQUIRED and is idempotency only — the £2.99, the 24
     hours, the buyer and the shift all come from the server.
     A shift that is not boostable (cancelled, filled, finished, already
     boosted) returns { error, reason } with a 409.
     If a business card was requested but none is on file the fn returns
     { error: "no_business_card", business_id } with a 409.

   confirm-boost ← the fast answer for the employer watching the screen. It
                   verifies the payment and then calls the SAME fulfiller the
                   Stripe webhook calls, so a boost still lands if this page
                   never comes back → { ok, boosted_until, already }.
                   `already: true` means the webhook got there first — that is
                   success, not a second 24 hours.                              */

function invokeError(error: {
  message: string;
  context?: { json?: () => Promise<{ error?: string; business_id?: string }> };
}): Promise<never> {
  return (async () => {
    let msg = error.message;
    try {
      const b = await error.context?.json?.();
      if (b?.error) msg = b.error;
    } catch {
      /* */
    }
    throw new Error(msg);
  })();
}

export type ShiftBoostStart =
  | { charged: true; payment_intent_id?: string }
  | { clientSecret: string; payment_intent_id?: string };

/** Sentinel a caller can catch to prompt "add a business card first". */
export const NO_BUSINESS_CARD = "no_business_card";

/**
 * `attemptId` is the reference for ONE deliberate checkout, minted by the modal
 * and held across retries. It goes into the Stripe idempotency key, so pressing
 * Pay twice reaches the same PaymentIntent and a genuinely new purchase reaches
 * a new one. Switching card (personal ↔ business) inside one attempt keeps the
 * id: it is the same purchase, and the key already varies by card route.
 */
export async function startShiftBoost(
  shiftId: string,
  attemptId: string,
  opts: { useSavedCard?: boolean; useBusinessCard?: boolean; businessId?: string } = {},
): Promise<ShiftBoostStart> {
  const { useSavedCard = false, useBusinessCard = false, businessId } = opts;
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("create-boost-intent", {
    body: {
      shift_id: shiftId,
      client_request_id: attemptId,
      use_saved_card: useSavedCard,
      ...(useBusinessCard ? { use_business_card: true, business_id: businessId } : {}),
    },
  });
  if (error) {
    // Surface the no-business-card signal so the UI can prompt to add one.
    try {
      const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
      if (b?.error === "no_business_card") throw new Error(NO_BUSINESS_CARD);
    } catch (e) {
      if (e instanceof Error && e.message === NO_BUSINESS_CARD) throw e;
    }
    return invokeError(error);
  }
  // A saved-card charge the issuer wants authenticated is PAUSED, not failed.
  // Complete THAT PaymentIntent here — never start a second one. The card-form
  // path carries no `status`, so it returns straight through unchanged.
  const settled = await settleSavedCardPayment(data as ScaStart);
  if (settled.outcome === "cancelled") throw new Error("Payment cancelled — nothing was charged.");
  if (settled.outcome === "failed") throw new Error(settled.message);
  if (settled.outcome === "succeeded") return { ...(data as object), charged: true } as ShiftBoostStart;
  return data as ShiftBoostStart;
}

export async function confirmShiftBoost(
  shiftId: string,
  paymentIntentId: string,
): Promise<{ ok: boolean; boosted_until: string | null; already: boolean; note?: string }> {
  const sb = createClient();
  // payment_intent_id is REQUIRED: confirm-boost verifies the £2.99 payment with
  // Stripe before featuring the shift, so pass the id from startShiftBoost.
  const { data, error } = await sb.functions.invoke("confirm-boost", {
    body: { shift_id: shiftId, payment_intent_id: paymentIntentId },
  });
  if (error) return invokeError(error);
  return data;
}

/** Does the business have a card on file? (decides whether to offer its card) */
export async function businessHasCard(businessId: string): Promise<boolean> {
  const sb = createClient();
  // Whether a business has a card on file is owner-private: it says something
  // about their payment setup, and only they need to know it. The RPC refuses
  // anyone who does not own this business, so a non-owner gets false rather
  // than an answer about somebody else's account.
  const { data } = await sb
    .rpc("business_private_fields", { p_business_id: businessId })
    .maybeSingle<{ has_business_payment_method: boolean }>();
  return !!data?.has_business_payment_method;
}
