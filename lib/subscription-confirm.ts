/**
 * subscription-confirm.ts — what somebody is told before a recurring
 * subscription starts taking money from them.
 *
 * A subscription is not a purchase. It is a standing instruction, and the
 * screen that begins one has to say so plainly: which plan, how much, how
 * often, and that it repeats. The first version of this flow said none of it —
 * a saved card was charged £12 the moment the billing page loaded with
 * `?plan=pro` on the end of the URL, because a `useEffect` started the
 * checkout on mount. Nobody pressed anything that mentioned money.
 *
 * The copy lives here, apart from the component, so the exact words and
 * figures can be tested for every plan and period rather than read off a
 * screenshot.
 *
 * The numbers are the ones the SITE quotes. They are not authority: the server
 * re-reads the real Stripe Price and refuses to charge anything that does not
 * match (see assertPriceMatches in supabase/functions/_shared/tier-price.ts).
 * This is what the owner is promised; that is what enforces it.
 */

import {
  TIER_LABEL,
  TIER_PRICE_PENCE,
  PREMIUM_ANNUAL_PENCE,
} from "./listing-tiers.ts";

export type PaidTier = "pro" | "premium";
export type ConfirmPeriod = "monthly" | "annual";

export interface SubscriptionConfirmCopy {
  /** Dialog heading. */
  title: string;
  /** "Pro" / "Premium". */
  plan: string;
  /** "£12" — the amount, on its own. */
  amount: string;
  /** "month" / "year". */
  interval: string;
  /** "£12 a month" — amount and interval, as it reads in a sentence. */
  price: string;
  /** The sentence that makes the recurrence explicit. */
  recurrence: string;
  /** The final, irreversible action. Says the money and the interval again. */
  confirmLabel: string;
  /** The way out. */
  cancelLabel: string;
  /** Pence, for anything that needs the figure rather than the words. */
  amountPence: number;
}

/** £12, £29, £290 — no trailing pennies when there are none. */
function money(pence: number): string {
  const pounds = pence / 100;
  return `£${pounds.toFixed(2).replace(/\.00$/, "")}`;
}

/**
 * Annual is Premium-only, exactly as the server has it: asking for annual Pro
 * gets monthly Pro rather than an error, because the two must not be able to
 * disagree about what is being sold. See resolveTierPrice.
 */
export function isAnnual(tier: PaidTier, period: ConfirmPeriod): boolean {
  return tier === "premium" && period === "annual";
}

export function subscriptionConfirmCopy(
  tier: PaidTier,
  period: ConfirmPeriod = "monthly",
): SubscriptionConfirmCopy {
  const annual = isAnnual(tier, period);
  const amountPence = annual ? PREMIUM_ANNUAL_PENCE : TIER_PRICE_PENCE[tier];
  const amount = money(amountPence);
  const interval = annual ? "year" : "month";
  const plan = TIER_LABEL[tier];

  return {
    title: `Subscribe to ${plan}?`,
    plan,
    amount,
    interval,
    price: `${amount} a ${interval}`,
    recurrence:
      `This is a subscription. ${amount} is taken today and again every ` +
      `${interval} until you cancel. You can cancel any time from this page.`,
    confirmLabel: `Subscribe for ${amount}/${interval}`,
    cancelLabel: "Not now",
    amountPence,
  };
}
