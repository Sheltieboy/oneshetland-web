import { TIER_PRICE } from "@/lib/listing-tiers";

/**
 * Get it done job enquiries are a Pro / Premium entitlement. The DATABASE is the authority (create_brief_matches uses
 * business_meets_tier('pro'): live tier AND an unexpired subscription_until, failing closed). This mirrors that rule only to
 * tell the owner the truth on screen. Never use it to grant anything.
 */
export function jobMatchingActive(tier: string | null | undefined, until: string | null | undefined, now: number = Date.now()): boolean {
  if (tier !== "pro" && tier !== "premium") return false;
  if (!until) return false;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > now;
}

export const PRO_PRICE = TIER_PRICE.pro;   // "£12/mo": one source with the plans page

export const GID_PLAN_LINE = `Job enquiries are included with OneShetland Pro (${PRO_PRICE}) and Premium.`;
