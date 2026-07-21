"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Referrals — web mirror of the app's lib/referrals.ts. Code + reward crediting
 * are server-side (ensure_referral_code / apply_referral_code RPCs + a DB trigger
 * on the referee's first spend). Reward is £5 wallet credit for each side.
 */

export const REFERRAL_REWARD_PENCE = 500;

export interface ReferralEntry {
  id: string;
  status: "pending" | "rewarded" | "void";
  reward_pence: number;
  name: string;
  created_at: string;
}

export interface MyReferrals {
  code: string;
  entries: ReferralEntry[];
  joined: number;
  earned_pence: number;
}

async function myCode(sb: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data, error } = await sb.rpc("ensure_referral_code", { p_user: userId });
  if (error) throw error;
  return data as string;
}

export async function fetchMyReferrals(): Promise<MyReferrals> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Sign in to see your referrals.");
  const code = await myCode(sb, auth.user.id);
  const { data, error } = await sb
    .from("referrals")
    .select("id, status, referrer_reward_pence, created_at, referee:profiles!referrals_referee_id_fkey(display_name, full_name)")
    .eq("referrer_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const entries: ReferralEntry[] = (data ?? []).map((r: Record<string, unknown>) => {
    const rawRef = r.referee as { display_name?: string | null; full_name?: string | null } | Array<{ display_name?: string | null; full_name?: string | null }> | null;
    const ref = Array.isArray(rawRef) ? rawRef[0] : rawRef;
    return {
      id: r.id as string,
      status: r.status as ReferralEntry["status"],
      reward_pence: r.referrer_reward_pence as number,
      name: ref?.display_name || ref?.full_name || "A friend",
      created_at: r.created_at as string,
    };
  });
  return {
    code,
    entries,
    joined: entries.length,
    earned_pence: entries.filter((e) => e.status === "rewarded").reduce((s, e) => s + e.reward_pence, 0),
  };
}

export async function applyReferralCode(code: string): Promise<{ ok: boolean; error?: string }> {
  const sb = createClient();
  const { data, error } = await sb.rpc("apply_referral_code", { p_code: code.trim() });
  if (error) throw error;
  return data as { ok: boolean; error?: string };
}
