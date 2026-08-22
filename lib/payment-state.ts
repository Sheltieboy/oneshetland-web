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
 * Booleans only. No cus_…, acct_… or pm_… ever leaves here, so the account
 * screens keep consuming safe derived state rather than raw Stripe identifiers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentState = {
  /** A card is saved with Stripe and can be charged. */
  card_on_file: boolean;
  /** Stripe will pay this person out. */
  payouts_connected: boolean;
  /** An account exists but Stripe has not finished verifying it. */
  payouts_pending: boolean;
};

export const NO_PAYMENT_STATE: PaymentState = {
  card_on_file: false,
  payouts_connected: false,
  payouts_pending: false,
};

/**
 * Resolves a user's effective card and payout state.
 *
 * Server-side only — it reads columns the browser has no business holding.
 */
export async function getPaymentState(
  sb: SupabaseClient,
  userId: string,
): Promise<PaymentState> {
  const [{ data: prof }, { data: drv }] = await Promise.all([
    sb.from("profiles")
      .select("has_payment_method, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled")
      .eq("id", userId).maybeSingle(),
    sb.from("driver_profiles")
      .select("stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled")
      .eq("id", userId).maybeSingle(),
  ]);

  const hasAccount = !!(prof?.stripe_account_id || drv?.stripe_account_id);
  const onboarded = !!(prof?.stripe_onboarding_complete || drv?.stripe_onboarding_complete);
  const connected = !!(prof?.stripe_payouts_enabled || drv?.stripe_payouts_enabled);

  return {
    card_on_file:      !!prof?.has_payment_method,
    payouts_connected: connected,
    payouts_pending:   hasAccount && !onboarded,
  };
}
