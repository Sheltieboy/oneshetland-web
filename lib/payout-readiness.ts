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
 * Two short, shared, per-business, in-memory guards around actually launching
 * a payout onboarding link — the merchant-facing counterpart to
 * supabase/functions/_shared/rate-limit.ts's own server-side ceiling on
 * local-business-onboard / create-connect-account, found when several
 * onboarding entry points were opened in quick succession and the raw
 * "Too many requests" the server returns reached the merchant unexplained.
 *
 *  · LAUNCH GUARD (5s) — an anti-double-tap guard across screens. Starts
 *    when any launch begins, whether it succeeds or not, and only stops
 *    immediate repeat taps / cross-surface hammering. It is NOT a claim that
 *    the server is limiting anyone.
 *  · RATE-LIMIT BACKOFF — starts only after a genuine 429 from the server.
 *    The server's own window for Connect/onboarding-link creation is an hour
 *    (rate_limit_policies: stripe_account, 6 per 3600s) and its Retry-After is
 *    the seconds left in that window — anything from 1s to an hour, so
 *    retrying after only a few seconds would just earn another 429. The
 *    server-provided Retry-After is used when the invocation layer exposes it
 *    (see lib/retry-after.ts); otherwise a fixed fallback.
 *
 * Both are in memory only, cleared on reload — nothing persisted, no table.
 * Every launcher shares the same two maps, keyed by businessId: the
 * contextual guard below (event/product/pass/Wallet, via
 * startOrResumePayoutSetup) AND the explicit "use my own business bank"
 * Plan & payouts control, which does not route through
 * startOrResumePayoutSetup at all — hopping between them for the same
 * business is one burst, not a fresh allowance each time.
 */
const PAYOUT_ONBOARDING_LAUNCH_GUARD_MS = 5_000;
const PAYOUT_ONBOARDING_BACKOFF_FALLBACK_MS = 60_000;
const PAYOUT_ONBOARDING_BACKOFF_MAX_MS = 3_600_000;
const payoutOnboardingLaunchGuardUntil = new Map<string, number>();
const payoutOnboardingBackoffUntil = new Map<string, number>();

/** True while the short launch guard OR a real-429 backoff is active. */
export function isPayoutOnboardingCoolingDown(businessId: string): boolean {
  const now = Date.now();
  const guard = payoutOnboardingLaunchGuardUntil.get(businessId);
  const backoff = payoutOnboardingBackoffUntil.get(businessId);
  return (guard !== undefined && now < guard) || (backoff !== undefined && now < backoff);
}

/** True only while a backoff started by a real 429 is active. */
export function isPayoutOnboardingBackedOff(businessId: string): boolean {
  const backoff = payoutOnboardingBackoffUntil.get(businessId);
  return backoff !== undefined && Date.now() < backoff;
}

function rateLimitedCooldownError(): Error {
  // Reuses the exact wording enforceRateLimit() returns, so
  // classifyPayoutOnboardingError treats a client-side block and a genuine
  // server 429 identically — one signal, one code path. Never shown: every
  // catch block turns it into the friendly message.
  return Object.assign(new Error("Too many requests"), { status: 429 });
}

function startPayoutOnboardingBackoff(businessId: string, retryAfterSecs: number | undefined): void {
  const ms = retryAfterSecs !== undefined && retryAfterSecs > 0
    ? retryAfterSecs * 1000
    : PAYOUT_ONBOARDING_BACKOFF_FALLBACK_MS;
  payoutOnboardingBackoffUntil.set(businessId, Date.now() + Math.min(ms, PAYOUT_ONBOARDING_BACKOFF_MAX_MS));
}

/**
 * Wraps one payout-onboarding launch call (creating/resuming an onboarding
 * link): refuses without ever reaching the network while either guard is
 * active, otherwise starts the short launch guard and makes the one real
 * call. If that call comes back genuinely rate-limited, the longer backoff
 * starts — a synthetic refusal from this function never does, so the
 * backoff cannot extend itself.
 */
export async function guardPayoutOnboardingLaunch<T>(businessId: string, fn: () => Promise<T>): Promise<T> {
  if (isPayoutOnboardingCoolingDown(businessId)) throw rateLimitedCooldownError();
  payoutOnboardingLaunchGuardUntil.set(businessId, Date.now() + PAYOUT_ONBOARDING_LAUNCH_GUARD_MS);
  try {
    return await fn();
  } catch (e) {
    if (classifyPayoutOnboardingError(e) === "rate_limited") {
      startPayoutOnboardingBackoff(businessId, (e as { retryAfterSecs?: number } | null | undefined)?.retryAfterSecs);
    }
    throw e;
  }
}

export type PayoutOnboardingErrorKind = "rate_limited" | "ordinary";

/**
 * Distinguishes a rate-limited onboarding-launch failure — whether from this
 * module's own cooldown above or from enforceRateLimit()'s real 429 — from
 * an ordinary onboarding failure, so every catch block can show the right
 * message without re-deriving this itself.
 */
export function classifyPayoutOnboardingError(err: unknown): PayoutOnboardingErrorKind {
  const status = (err as { status?: number } | null | undefined)?.status;
  if (status === 429) return "rate_limited";
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/too many requests/i.test(message)) return "rate_limited";
  return "ordinary";
}

/**
 * notify()-shaped options (components/ui/ConfirmProvider.tsx) for a caught
 * onboarding error. A rate-limited response never shows its raw "Too many
 * requests" text or any other raw Stripe/edge-function wording — the
 * account's own state (Verification in progress, etc.) is untouched by
 * this, since nothing here writes to the business at all.
 */
export function payoutOnboardingErrorNotify(err: unknown): { title: string; body: string; okLabel: string } {
  if (classifyPayoutOnboardingError(err) === "rate_limited") {
    return {
      title: "Stripe setup is temporarily busy",
      body: "Please wait a moment, then try again. Your existing payout setup, if any, has not been changed.",
      okLabel: "OK",
    };
  }
  return {
    title: "Stripe onboarding failed",
    body: err instanceof Error ? err.message : "Try again later",
    okLabel: "OK",
  };
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
  // A synchronous, in-memory check — no await, so it adds no task boundary
  // between the click and the popup below. While a guard or backoff is
  // active nothing will be launched, so no blank window is opened for a launch
  // that cannot happen; the readiness check below still runs first, so an
  // already-ready business is never told it is "busy".
  const blocked = isPayoutOnboardingCoolingDown(businessId);
  const popup = blocked ? null : openStripePopup();
  try {
    // Fresh canonical check first — never start onboarding a business that
    // is already payable, whether it always was or the caller's own state
    // (e.g. a stale payout_ready read on a list row) is merely out of date.
    if (await requirePayoutReadyForPaidActivation(businessId)) {
      popup?.close();
      return { ready: true };
    }
    if (blocked) throw rateLimitedCooldownError();

    const sb = createClient();
    const { data: priv } = await sb
      .rpc("business_private_fields", { p_business_id: businessId })
      .maybeSingle<{ use_business_payout: boolean }>();
    const usesOwnAccount = priv?.use_business_payout === true;

    let url: string | null;
    if (usesOwnAccount) {
      ({ url } = await guardPayoutOnboardingLaunch(businessId, () => createBusinessOnboardingLink(businessId)));
    } else {
      const central = await guardPayoutOnboardingLaunch(businessId, () => startPayoutOnboarding());
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
