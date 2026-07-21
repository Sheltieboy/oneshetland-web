"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Web client for the staff-verified redemption backbone (mirrors the app's
 * lib/local-api.ts helpers). Customer starts a redemption → shows a code/QR →
 * staff verify → effect applied. Used for offers, stamp rewards, passes, points.
 */
export type RedeemKind = "offer" | "reward" | "pass" | "points";
export type RedemptionTicket = {
  id: string; code: string; token: string; kind: RedeemKind;
  detail: { title?: string; subtitle?: string }; expires_at: string;
};

export async function startRedemption(kind: RedeemKind, refId: string, amount?: number): Promise<RedemptionTicket> {
  const { data, error } = await createClient().functions.invoke("local-redeem-start", {
    body: { kind, ref_id: refId, amount },
  });
  if (error) throw new Error(await fnError(error, "Could not start redemption."));
  return data as RedemptionTicket;
}

export async function verifyRedemption(input: { code?: string; token?: string }): Promise<{ ok: boolean; kind: RedeemKind; detail: { title?: string; subtitle?: string } }> {
  const { data, error } = await createClient().functions.invoke("local-redeem-verify", { body: input });
  if (error) throw new Error(await fnError(error, "Could not verify."));
  return data as { ok: boolean; kind: RedeemKind; detail: { title?: string; subtitle?: string } };
}

export async function getRedemptionStatus(id: string): Promise<"pending" | "consumed" | "expired" | "cancelled" | null> {
  const { data } = await createClient().from("local_redemptions").select("status").eq("id", id).maybeSingle();
  return (data?.status as "pending" | "consumed" | "expired" | "cancelled" | undefined) ?? null;
}

/** Supabase FunctionsHttpError hides the JSON body — dig out the real message. */
async function fnError(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      if (body?.error) return body.error as string;
    }
  } catch { /* fall through */ }
  return error instanceof Error ? error.message : fallback;
}
