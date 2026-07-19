"use client";

import { createClient } from "@/lib/supabase/client";

/* ── Boost a shift (£2.99, 24h featured) ───────────────────────────────────────
   Mirrors the app's two-step contract:

   create-boost-intent → { charged } (saved/business card, off-session) |
                         { clientSecret } (card form fallback, no saved card)
     Body: { shift_id, use_saved_card?, use_business_card?, business_id? }
     If a business card was requested but none is on file the fn returns
     { error: "no_business_card", business_id } with a 409.

   confirm-boost ← keyed by shift_id; sets boosted_until = now + 24h, alerts
                   matching workers → { ok, boosted_until, notified }            */

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

export async function startShiftBoost(
  shiftId: string,
  opts: { useSavedCard?: boolean; useBusinessCard?: boolean; businessId?: string } = {},
): Promise<ShiftBoostStart> {
  const { useSavedCard = false, useBusinessCard = false, businessId } = opts;
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("create-boost-intent", {
    body: {
      shift_id: shiftId,
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
  return data as ShiftBoostStart;
}

export async function confirmShiftBoost(
  shiftId: string,
  paymentIntentId: string,
): Promise<{ ok: boolean; boosted_until: string; notified: number }> {
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
  const { data } = await sb
    .from("local_businesses")
    .select("has_business_payment_method")
    .eq("id", businessId)
    .maybeSingle();
  return !!(data as { has_business_payment_method: boolean } | null)?.has_business_payment_method;
}
