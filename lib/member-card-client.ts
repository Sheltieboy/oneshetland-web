"use client";

import { createClient } from "@/lib/supabase/client";

/** Web mirror of the app's lib/member-card.ts — the "one card" client surface. */

export interface TillOffer { id: string; title: string; badge: string; claimed: boolean; }
export interface TillLookup {
  ok: boolean;
  customer: { name: string };
  business: { id: string; name: string };
  program: {
    type: "stamps" | "points";
    stamps_required: number | null;
    stamp_reward: string | null;
    reward_tiers: { stamps: number; reward: string }[];
    points_per_pound: number | null;
    points_for_pound: number | null;
  } | null;
  card: { stamps_collected: number; points_balance: number; tiers_redeemed_upto: number } | null;
  ready_reward: { stamps: number; reward: string } | null;
  offers: TillOffer[];
}

export async function getMyMemberCode(): Promise<string> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Sign in to see your card.");
  const { data, error } = await sb.rpc("ensure_member_code", { p_user: auth.user.id });
  if (error) throw error;
  return data as string;
}

async function callTill(body: Record<string, unknown>): Promise<unknown> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("loyalty-till", { body });
  if (error) {
    let msg = error.message;
    try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (b?.error) msg = b.error; } catch { /* */ }
    throw new Error(msg);
  }
  return data;
}

export function tillLookup(memberCode: string, businessId?: string): Promise<TillLookup> {
  return callTill({ member_code: memberCode, business_id: businessId, action: "lookup" }) as Promise<TillLookup>;
}

export function tillAction(
  action: "stamp" | "points" | "redeem_reward" | "redeem_offer",
  memberCode: string,
  opts: { businessId?: string; amountPence?: number; offerId?: string } = {},
): Promise<{ ok: boolean; message: string }> {
  return callTill({ member_code: memberCode, business_id: opts.businessId, action, amount_pence: opts.amountPence, offer_id: opts.offerId }) as Promise<{ ok: boolean; message: string }>;
}
