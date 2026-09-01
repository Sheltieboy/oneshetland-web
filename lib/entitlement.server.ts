/**
 * entitlement.server.ts — what this business's plan actually allows, today.
 *
 * One reader for the one deployed predicate. business_meets_tier is the same
 * function the triggers and read policies use, so the owner's screen and the
 * server cannot disagree about whether something may go live.
 *
 * Configured tier is NOT entitlement. A business row saying 'premium' with an
 * expiry last March is not entitled to anything, and tierUnlocks() cannot tell
 * the difference — which is why presentation asks here instead.
 */

import { createClient } from "@/lib/supabase/server";

export type Effective = { pro: boolean; premium: boolean };

/**
 * Unreadable is treated as NOT entitled. That is the safe direction for
 * presentation: it can only ever under-promise, and the server refuses anyway.
 * It never blocks entry — the four setup-first capabilities stay open
 * regardless, because being unsure about a plan is no reason to lock somebody
 * out of their own drafts.
 */
export async function getEffectiveTier(businessId: string): Promise<Effective> {
  const sb = await createClient();
  const [pro, premium] = await Promise.allSettled([
    sb.rpc("business_meets_tier", { p_business_id: businessId, p_required_tier: "pro" }),
    sb.rpc("business_meets_tier", { p_business_id: businessId, p_required_tier: "premium" }),
  ]);
  const ok = (r: PromiseSettledResult<{ data: unknown; error: unknown }>) =>
    r.status === "fulfilled" && !r.value.error && r.value.data === true;
  return { pro: ok(pro), premium: ok(premium) };
}
