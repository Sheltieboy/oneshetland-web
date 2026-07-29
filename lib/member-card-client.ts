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

async function invokeErr(error: unknown): Promise<Error> {
  let msg = (error as { message?: string }).message ?? "Something went wrong";
  try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (b?.error) msg = b.error; } catch { /* */ }
  return new Error(msg);
}

async function callTill(body: Record<string, unknown>): Promise<unknown> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("loyalty-till", { body });
  if (error) throw await invokeErr(error);
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

/* ── Charge by scan ────────────────────────────────────────────────────────────
   Business scans the member card and REQUESTS a payment; the customer approves
   it on their own phone before any money moves. See wallet-charge-* edge fns. */

export interface ChargeRequest { request_id: string; customer_name: string; amount_pence: number; expires_at: string; }
export type ChargeStatus = "pending" | "charging" | "paid" | "declined" | "expired" | "failed";

/** Business side: raise a pending charge request from a scanned member code. */
export async function createChargeRequest(memberCode: string, amountPence: number, businessId?: string): Promise<ChargeRequest> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("wallet-charge-request", {
    body: { member_code: memberCode, amount_pence: amountPence, business_id: businessId },
  });
  if (error) throw await invokeErr(error);
  return data as ChargeRequest;
}

/** Business side: poll a request's status while waiting for the customer. */
export async function getChargeStatus(requestId: string): Promise<ChargeStatus | null> {
  const sb = createClient();
  const { data } = await sb.from("wallet_charge_requests").select("status").eq("id", requestId).maybeSingle();
  return (data as { status: ChargeStatus } | null)?.status ?? null;
}

/** Customer side: approve or decline a charge request aimed at them. */
export async function respondToCharge(
  requestId: string,
  decision: "approve" | "decline",
): Promise<{ ok?: boolean; declined?: boolean; balance_pence?: number; cashback_pence?: number }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("wallet-charge-approve", {
    body: { request_id: requestId, decision },
  });
  if (error) throw await invokeErr(error);
  return data as { ok?: boolean; declined?: boolean; balance_pence?: number; cashback_pence?: number };
}
