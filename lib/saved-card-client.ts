"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * saved-card-client.ts — what the buyer's saved card really is, from the server.
 *
 * Asks the `saved-card-state` function, which resolves the card from Stripe
 * through the canonical customer/payment-method helper. It is deliberately NOT
 * derived from profiles.has_payment_method: that flag says a card was added once,
 * not that one can be charged now (it was true for buyers with no Stripe
 * Customer at all).
 *
 * Only brand and last4 ever arrive here. No customer id, payment-method id,
 * expiry or number exists on this side, and none can be requested.
 *
 * `unknown` is a real answer — Stripe could not be asked — and is not `none`:
 * the caller offers the card form without claiming the buyer has no card.
 */

export type SavedCard = { brand: string | null; last4: string | null };

export type SavedCardState =
  | { state: "card"; card: SavedCard }
  | { state: "none" }
  | { state: "unknown" };

export async function fetchSavedCardState(): Promise<SavedCardState> {
  try {
    const sb = createClient();
    const { data, error } = await sb.functions.invoke("saved-card-state");
    if (error || !data) return { state: "unknown" };
    if (data.state === "card") {
      return {
        state: "card",
        card: {
          brand: typeof data.brand === "string" ? data.brand : null,
          last4: typeof data.last4 === "string" ? data.last4 : null,
        },
      };
    }
    if (data.state === "none") return { state: "none" };
    return { state: "unknown" };
  } catch {
    return { state: "unknown" };
  }
}
