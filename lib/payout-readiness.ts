import { createClient } from "@/lib/supabase/client";
import { createBusinessOnboardingLink } from "@/lib/business-client";
import { startPayoutOnboarding } from "@/lib/payment-state";

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

function openStripePopup(): Window | null {
  const w = 680, h = 720;
  return window.open("about:blank", "stripe-connect",
    `width=${w},height=${h},left=${(window.screen.width - w) / 2},top=${(window.screen.height - h) / 2},scrollbars=yes,resizable=yes`);
}

function waitForClose(popup: Window): Promise<void> {
  return new Promise((resolve) => {
    const poll = setInterval(() => { if (popup.closed) { clearInterval(poll); resolve(); } }, 700);
  });
}

/**
 * startOrResumePayoutSetup — the one contextual "Connect Stripe" action, for
 * every paid-activation guard above. Every caller used to hand the confirm
 * dialog a router.push to the business's Plan & payouts screen — one extra
 * page, and one extra decision, to reach a control OneShetland already knew
 * the exact answer for. This opens the correct onboarding flow directly
 * instead.
 *
 * "Correct" is business_payout_ready's own rule, not a new one: a business
 * uses its own Connect account only once it has been explicitly given one
 * (use_business_payout, read via the owner-checked business_private_fields
 * RPC — never reconstructed from a raw column select), otherwise it
 * inherits its owner's central account — see _business_payout_resolve. Both
 * onboarding calls are the existing, unchanged mechanisms
 * (createBusinessOnboardingLink / startPayoutOnboarding — see
 * lib/business-client.ts and lib/payment-state.ts), and each already resumes
 * an existing Stripe account rather than creating a second one.
 *
 * Opens the popup as the very first statement, before any await, so it
 * survives popup blockers exactly like every existing inline Connect
 * button — this function IS what a click handler calls directly. Resolves
 * once the popup closes (matching the mobile app's WebBrowser.openBrowserAsync
 * semantics — see lib/payout-readiness.ts there), so mobile and web callers
 * share the same "await it, then refresh" shape. No returnContext
 * parameter: the popup is never a redirect away from the caller's own page,
 * so awaiting it already returns the merchant to exactly where they were —
 * a stronger guarantee than passing one back in would give.
 */
export async function startOrResumePayoutSetup(businessId: string): Promise<{ ready: boolean }> {
  const popup = openStripePopup();
  try {
    // Fresh canonical check first — never start onboarding a business that
    // is already payable, whether it always was or the caller's own state
    // (e.g. a stale payout_ready read on a list row) is merely out of date.
    if (await requirePayoutReadyForPaidActivation(businessId)) {
      popup?.close();
      return { ready: true };
    }

    const sb = createClient();
    const { data: priv } = await sb
      .rpc("business_private_fields", { p_business_id: businessId })
      .maybeSingle<{ use_business_payout: boolean }>();
    const usesOwnAccount = priv?.use_business_payout === true;

    let url: string | null;
    if (usesOwnAccount) {
      ({ url } = await createBusinessOnboardingLink(businessId));
    } else {
      const central = await startPayoutOnboarding();
      if (central.alreadyComplete) {
        popup?.close();
        return { ready: await requirePayoutReadyForPaidActivation(businessId) };
      }
      url = central.url;
    }
    if (!url) throw new Error("No onboarding link was returned.");

    if (popup && !popup.closed) {
      popup.location.href = url;
      await waitForClose(popup);
    } else {
      window.location.href = url; // popup blocked → redirect
    }
  } catch (e) {
    popup?.close();
    throw e;
  }
  return { ready: await requirePayoutReadyForPaidActivation(businessId) };
}
