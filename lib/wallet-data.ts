"use client";

import { createClient } from "@/lib/supabase/client";

export type WalletTxType = "topup" | "spend" | "cashback" | "refund";

export interface WalletTransaction {
  id: string;
  user_id: string;
  business_id: string | null;
  type: WalletTxType;
  amount_pence: number;
  description: string | null;
  created_at: string;
  // joined
  business: { name: string } | null;
}

/**
 * Recent wallet transactions for the signed-in user, newest first.
 * Mirrors the app's `fetchWalletTransactions` (lib/local-api.ts): reads
 * `local_wallet_transactions`, then joins the business name from
 * `local_businesses` for `spend` rows. Returns [] when logged out.
 */
export async function fetchWalletTransactions(limit = 50): Promise<WalletTransaction[]> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await sb
    .from("local_wallet_transactions")
    .select("id, user_id, business_id, type, amount_pence, description, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as Omit<WalletTransaction, "business">[];
  const businessIds = [...new Set(rows.map((r) => r.business_id).filter(Boolean))] as string[];
  if (businessIds.length === 0) return rows.map((r) => ({ ...r, business: null }));

  const { data: biz } = await sb
    .from("local_businesses")
    .select("id, name")
    .in("id", businessIds);
  const bizMap = Object.fromEntries(((biz ?? []) as { id: string; name: string }[]).map((b) => [b.id, b]));

  return rows.map((r) => ({
    ...r,
    business: r.business_id ? bizMap[r.business_id] ?? null : null,
  }));
}
