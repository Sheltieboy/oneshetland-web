/**
 * payment-state.ts — the one answer to "has this person got a card, and can
 * they be paid?"
 *
 * WHAT WAS WRONG
 *
 * The My Account summary and the Payments & banking page disagreed about the
 * same signed-in user: the summary said "Payment card: not set up · Payouts: not
 * connected" while Manage said "On file ✓ · Connected ✓".
 *
 * Two separate causes, both fixed by having one derivation instead of two:
 *
 * 1. The summary read `account.profile.has_payment_method` and
 *    `account.profile.stripe_payouts_enabled` — but getAccount() never SELECTED
 *    those columns. They were always undefined, so the summary reported "not set
 *    up" for every user on the site, whatever their real state. A
 *    `as { has_payment_method?: boolean }` cast is what stopped the compiler
 *    saying so.
 *
 * 2. Payout state can live on profiles OR on driver_profiles, because the Fetch
 *    driver onboarding historically wrote the Connect account there. Manage
 *    already coalesced both; the summary never did. A driver who connected in
 *    the app would have been told they were not connected even once (1) was
 *    fixed.
 *
 * WHAT THIS RETURNS
 *
 * Safe derived state only: booleans, plus a card's brand and last four digits. No
 * cus_…, acct_… or pm_… ever leaves here, so the account screens never hold a raw
 * Stripe identifier.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { retryAfterSecsFrom } from "@/lib/retry-after";

/**
 * What the server found when it asked Stripe about this person's saved card.
 * `unknown` means Stripe could not be asked — which is NOT the same as `none`.
 */
export type CardState = "card" | "none" | "unknown";

export type PaymentState = {
  /** A card is saved with Stripe and can be charged (canonical — see resolveCardState). */
  card_on_file: boolean;
  card_state: CardState;
  /** Safe display metadata only. Null unless card_state is "card". */
  card_brand: string | null;
  card_last4: string | null;
  /** Stripe will pay this person out. */
  payouts_connected: boolean;
  /** An account exists but Stripe has not finished verifying it. */
  payouts_pending: boolean;
};

export const NO_PAYMENT_STATE: PaymentState = {
  card_on_file: false,
  card_state: "none",
  card_brand: null,
  card_last4: null,
  payouts_connected: false,
  payouts_pending: false,
};

export type ResolvedCard = { state: CardState; brand: string | null; last4: string | null };

/**
 * The ONE answer to "does this person have a saved card?" — the same one checkout
 * uses. It asks the `saved-card-state` function, which resolves the card from
 * Stripe through the canonical customer/payment-method helper (bound customer →
 * attached cards → default) and returns brand + last4 only.
 *
 * It deliberately does NOT read profiles.has_payment_method. That flag is a cache,
 * and it was true for profiles with no Stripe Customer at all: Account said "card
 * added" while checkout said "pay by card". Anything that shows or decides on a
 * saved card must come through here so the two can never disagree again.
 */
export async function resolveCardState(sb: SupabaseClient): Promise<ResolvedCard> {
  try {
    const { data, error } = await sb.functions.invoke("saved-card-state");
    if (error || !data) return { state: "unknown", brand: null, last4: null };
    if (data.state === "card") {
      return {
        state: "card",
        brand: typeof data.brand === "string" ? data.brand : null,
        last4: typeof data.last4 === "string" ? data.last4 : null,
      };
    }
    if (data.state === "none") return { state: "none", brand: null, last4: null };
    return { state: "unknown", brand: null, last4: null };
  } catch {
    return { state: "unknown", brand: null, last4: null };
  }
}

/**
 * Resolves a user's effective card and payout state.
 *
 * Server-side only — it reads columns the browser has no business holding.
 */
export async function getPaymentState(
  sb: SupabaseClient,
  userId: string,
): Promise<PaymentState> {
  const [{ data: prof }, { data: drv }, card] = await Promise.all([
    sb.from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled")
      .eq("id", userId).maybeSingle(),
    sb.from("driver_profiles")
      .select("stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled")
      .eq("id", userId).maybeSingle(),
    resolveCardState(sb),
  ]);

  const hasAccount = !!(prof?.stripe_account_id || drv?.stripe_account_id);
  const onboarded = !!(prof?.stripe_onboarding_complete || drv?.stripe_onboarding_complete);
  const connected = !!(prof?.stripe_payouts_enabled || drv?.stripe_payouts_enabled);

  return {
    card_on_file:      card.state === "card",
    card_state:        card.state,
    card_brand:        card.brand,
    card_last4:        card.last4,
    payouts_connected: connected,
    payouts_pending:   hasAccount && !onboarded,
  };
}


/**
 * Client-side: has the signed-in buyer got a card on file?
 *
 * Asks the same canonical resolver getPaymentState() uses (resolveCardState), so a
 * checkout and the Payments & banking screen cannot disagree about whether a card
 * exists. It is still only a hint for the REQUEST — the backend re-resolves the
 * card itself — but it is now a hint from the same source, not from a flag.
 */
export async function fetchCardOnFile(sb: SupabaseClient, _userId?: string): Promise<boolean> {
  return (await resolveCardState(sb)).state === "card";
}

/**
 * Starts or resumes CENTRAL (owner-level) payout onboarding — the account
 * that receives every payout when a business has not been given its own
 * (use_business_payout is off). Client-side only; mirrors the mobile app's
 * lib/payment-state.ts.
 *
 * create-connect-account resolves an EXISTING account (profiles, then
 * driver_profiles) before it creates one, so calling this twice cannot make
 * a second Connect account, and it never touches a business's own account —
 * that is a separate destination reached through createBusinessOnboardingLink
 * (lib/business-client.ts) once use_business_payout is on.
 *
 * The single implementation of this call: ConnectPayoutsButton and
 * startOrResumePayoutSetup (lib/payout-readiness.ts) both use it rather than
 * each invoking the edge function inline.
 */
export async function startPayoutOnboarding(): Promise<{ url: string | null; alreadyComplete: boolean }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("create-connect-account");
  if (error) {
    let msg = "Could not start payout setup.";
    const status = (error as { context?: { status?: number } }).context?.status;
    const retryAfterSecs = retryAfterSecsFrom((error as { context?: unknown }).context);
    try {
      const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
      if (body?.error) msg = body.error;
    } catch { /* keep the generic message */ }
    throw Object.assign(new Error(msg), status !== undefined ? { status } : {}, retryAfterSecs !== undefined ? { retryAfterSecs } : {});
  }
  const res = data as { url?: string; already_complete?: boolean } | null;
  if (res?.already_complete) return { url: null, alreadyComplete: true };
  if (!res?.url) throw new Error("No onboarding link was returned.");
  return { url: res.url, alreadyComplete: false };
}
