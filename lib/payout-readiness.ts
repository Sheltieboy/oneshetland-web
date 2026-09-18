import { createClient } from "@/lib/supabase/client";

/**
 * payout-readiness.ts — the one paid-activation gate, everywhere a
 * capability is about to go live and take a customer's money.
 *
 * Same shape as lib/commercial-terms.server.tsx and the mobile app's
 * lib/payout-readiness.ts: a pure check, plus a standard prompt shown when it
 * fails. Configuring, drafting and pricing a capability never call this —
 * only the moment it would become customer-purchasable does. Free-only
 * capabilities never call this either: a feature is only ever gated when it
 * can actually take money.
 *
 * The check itself is business_payout_ready(p_business) — the same RPC every
 * server payment path (event tickets, products, passes, gifts, Wallet) and
 * the merchant-facing status displays already ask. Nothing here reconstructs
 * stripe_account_id / payout_enabled / use_business_payout locally; a client
 * guard that did would be exactly how the dashboard's own payout status
 * drifted from the real rule.
 *
 * This is UX only. The server-side functions this gate protects already
 * refuse to move money with no valid payout route regardless of whether a
 * client ever calls this — see Phase 1 of this work. A bypassed or stale
 * client guard cannot make an unpayable business payable.
 *
 * Called client-side (same convention as the merchant screens that use it —
 * ProductsManager, UnitItemsManager, WalletManager and BusinessEventForm all
 * already talk to Supabase directly from the browser).
 */

/** Can OneShetland currently route money to this business? Fails closed: an
 *  unreadable answer is "not ready", never a guess that it is. */
export async function requirePayoutReadyForPaidActivation(businessId: string): Promise<boolean> {
  const sb = createClient();
  const { data, error } = await sb.rpc("business_payout_ready", { p_business: businessId });
  return !error && data === true;
}

/**
 * The one prompt shown at every paid-activation point, so the wording cannot
 * drift screen to screen. Shape matches useConfirm()'s ConfirmOpts
 * (components/ui/ConfirmProvider.tsx) — pass it straight through:
 *
 *     const goConnect = await confirm(PAYOUT_NOT_READY_PROMPT);
 *     if (goConnect) router.push(`/business/${businessId}/manage/billing`);
 *
 * "Where to actually reach Connect Stripe from here" is left to the caller
 * (a route to the existing Plan & payouts screen, or an inline connectBank()
 * where one already exists), since each screen's route back to it differs.
 */
export const PAYOUT_NOT_READY_PROMPT = {
  title: "Connect Stripe to take payments",
  body: "You can finish setting this up now, but connect Stripe before making it available to customers.",
  confirmLabel: "Connect Stripe",
  cancelLabel: "Keep as draft",
};

/**
 * Shown immediately after a paid/mixed event publish attempt was silently
 * downgraded to a draft — distinct from PAYOUT_NOT_READY_PROMPT above, which
 * fires BEFORE anything is saved. Here the save already succeeded; what
 * failed is specifically going live. Naming that explicitly is the whole
 * point — a merchant who only sees a generic error after a successful save
 * reasonably assumes something was lost. Mirrors mobile's
 * eventSavedAsDraftPrompt (lib/payout-readiness.ts) in wording.
 */
export const EVENT_SAVED_AS_DRAFT_PROMPT = {
  title: "Event saved as draft",
  body: "Your event isn't live yet. Connect Stripe before you can publish paid tickets. Your event and ticket settings have been saved.",
  confirmLabel: "Connect Stripe",
  cancelLabel: "Not now",
};
