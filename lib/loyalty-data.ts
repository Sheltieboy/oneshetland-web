"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Loyalty cards for the signed-in user.
 *
 * Mirrors the app's `fetchMyLoyaltyCards` (oneshetland-delivers/lib/local-api.ts):
 * reads `local_loyalty_cards` for the user, then joins the business (name, logo,
 * category) from `local_businesses` and the programme from `local_loyalty_programs`
 * client-side. Returns [] when logged out.
 *
 * Card model:
 *   • stamps programme → `stamps_collected` toward `program.stamps_required`,
 *     reward text in `program.stamp_reward`. Reward is "ready" when
 *     stamps_collected >= stamps_required.
 *   • points programme → running `points_balance`.
 */

export type LoyaltyType = "stamps" | "points";

export interface LoyaltyProgram {
  id: string;
  business_id: string;
  type: LoyaltyType;
  stamps_required: number | null;
  stamp_reward: string | null;
  points_per_pound: number | null;
  points_for_pound: number | null;
  is_active: boolean;
}

export interface LoyaltyCard {
  id: string;
  user_id: string;
  program_id: string;
  business_id: string;
  stamps_collected: number;
  points_balance: number;
  total_redeemed: number;
  last_stamp_at: string | null;
  created_at: string;
  // joined
  business: { name: string; logo_url: string | null; category: string } | null;
  program: LoyaltyProgram | null;
}

export async function fetchMyLoyaltyCards(): Promise<LoyaltyCard[]> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  const { data: cards, error } = await sb
    .from("local_loyalty_cards")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("last_stamp_at", { ascending: false, nullsFirst: false });
  if (error) throw error;

  const rows = (cards ?? []) as Omit<LoyaltyCard, "business" | "program">[];
  if (rows.length === 0) return [];

  const businessIds = [...new Set(rows.map((c) => c.business_id))];
  const programIds = [...new Set(rows.map((c) => c.program_id))];

  const [{ data: biz }, { data: progs }] = await Promise.all([
    sb.from("local_businesses").select("id, name, logo_url, category").in("id", businessIds),
    sb.from("local_loyalty_programs").select("*").in("id", programIds),
  ]);

  const bizMap = Object.fromEntries(
    ((biz ?? []) as { id: string; name: string; logo_url: string | null; category: string }[]).map((b) => [b.id, b]),
  );
  const progMap = Object.fromEntries(
    ((progs ?? []) as LoyaltyProgram[]).map((p) => [p.id, p]),
  );

  return rows.map((c) => ({
    ...c,
    business: bizMap[c.business_id]
      ? {
          name: bizMap[c.business_id].name,
          logo_url: bizMap[c.business_id].logo_url,
          category: bizMap[c.business_id].category,
        }
      : null,
    program: progMap[c.program_id] ?? null,
  }));
}

/** Is this stamp card's reward unlocked (collected >= required)? */
export function isRewardReady(card: LoyaltyCard): boolean {
  if (card.program?.type !== "stamps") return false;
  const needed = card.program?.stamps_required ?? 0;
  return needed > 0 && card.stamps_collected >= needed;
}
