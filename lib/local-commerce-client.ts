"use client";

import { createClient } from "@/lib/supabase/client";

function invokeError(error: { message: string; context?: { json?: () => Promise<{ error?: string }> } }): Promise<never> {
  return (async () => {
    let msg = error.message;
    try { const b = await error.context?.json?.(); if (b?.error) msg = b.error; } catch { /* */ }
    throw new Error(msg);
  })();
}

/* ── Buy a pass / unit ────────────────────────────────────────────────────────
   create-unit-purchase-intent → { charged } (saved card) | { clientSecret } (card form)
   confirm-unit-purchase ← keyed by unit_item_id (NOT order_id)                       */

export type UnitPurchaseStart =
  | { charged: true; payment_intent_id: string }
  | { clientSecret: string; payment_intent_id: string };

export async function startUnitPurchase(unitItemId: string, useSavedCard = true): Promise<UnitPurchaseStart> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("create-unit-purchase-intent", {
    body: { unit_item_id: unitItemId, use_saved_card: useSavedCard },
  });
  if (error) return invokeError(error);
  return data as UnitPurchaseStart;
}

export async function confirmUnitPurchase(
  unitItemId: string,
  paymentIntentId: string,
): Promise<{ ok: boolean; purchase_id: string; uses_remaining: number; expires_at: string | null }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("confirm-unit-purchase", {
    body: { unit_item_id: unitItemId, payment_intent_id: paymentIntentId },
  });
  if (error) return invokeError(error);
  return data;
}

/* ── Send a gift (unit or service) ────────────────────────────────────────────
   create-gift-intent → { charged, gift_id } | { clientSecret, gift_id }
   confirm-gift → { code, claim_url, email_sent }                                    */

export type GiftKind = "unit" | "booking";

export type GiftStart =
  | { charged: true; payment_intent_id: string; gift_id: string }
  | { clientSecret: string; payment_intent_id: string; gift_id: string };

export async function startGift(
  input: {
    kind: GiftKind;
    unitItemId?: string;
    serviceId?: string;
    recipientEmail: string;
    recipientName?: string | null;
    message?: string | null;
  },
  opts: { useSavedCard?: boolean; payWithWallet?: boolean } = {},
): Promise<GiftStart> {
  const { useSavedCard = true, payWithWallet = false } = opts;
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("create-gift-intent", {
    body: {
      kind: input.kind,
      unit_item_id: input.unitItemId,
      service_id: input.serviceId,
      recipient_email: input.recipientEmail,
      recipient_name: input.recipientName ?? null,
      message: input.message ?? null,
      use_saved_card: payWithWallet ? false : useSavedCard,
      pay_with_wallet: payWithWallet,
    },
  });
  if (error) return invokeError(error);
  return data as GiftStart;
}

export async function confirmGift(
  giftId: string,
  paymentIntentId: string,
): Promise<{ ok: boolean; gift_id: string; code: string; claim_url?: string; email_sent?: boolean }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("confirm-gift", {
    body: { gift_id: giftId, payment_intent_id: paymentIntentId },
  });
  if (error) return invokeError(error);
  return data;
}

/* ── Top up wallet ────────────────────────────────────────────────────────────
   local-wallet-topup-intent → { charged } | { clientSecret }
   local-wallet-confirm-topup → { balance_pence }                                    */

export type WalletTopUpStart =
  | { charged: true; payment_intent_id: string }
  | { clientSecret: string; payment_intent_id: string };

export async function startWalletTopUp(amountPence: number, useSavedCard = true): Promise<WalletTopUpStart> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("local-wallet-topup-intent", {
    body: { amount_pence: amountPence, use_saved_card: useSavedCard },
  });
  if (error) return invokeError(error);
  return data as WalletTopUpStart;
}

export async function confirmWalletTopUp(paymentIntentId: string): Promise<{ balance_pence: number }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("local-wallet-confirm-topup", {
    body: { payment_intent_id: paymentIntentId },
  });
  if (error) return invokeError(error);
  return data;
}

/* ── Wallet balance + pay-from-wallet ──────────────────────────────────────────
   The buyer's current balance (to decide whether to offer "Pay with wallet"),
   and `wallet-checkout` which debits the wallet and completes the purchase in one
   call — { ok, balance_pence, ...type-specific }. No confirm step (self-contained). */

export async function fetchWalletBalance(): Promise<number> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return 0;
  const { data } = await sb
    .from("local_wallet_balances")
    .select("balance_pence")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return (data as { balance_pence: number } | null)?.balance_pence ?? 0;
}

/* ── Pay at till (wallet → business) ───────────────────────────────────────────
   Mirrors the app's `payWithWallet` (oneshetland-delivers/lib/local-api.ts) and the
   `local-pay.tsx` flow: the customer reads the business's rotating 6-digit till code,
   enters it together with the amount, and `local-wallet-pay` debits their wallet,
   credits any cashback, and transfers to the business. The edge function identifies
   the *customer* from their auth JWT — there is no customer-side code/QR in this model;
   the merchant displays the code and the customer enters it. */

export async function payWithWallet(
  code: string,
  amountPence: number,
): Promise<{ balance_pence: number; cashback_pence: number }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("local-wallet-pay", {
    body: { code, amount_pence: amountPence },
  });
  if (error) return invokeError(error);
  return data as { balance_pence: number; cashback_pence: number };
}

export type WalletCheckoutBody =
  | { type: "unit_purchase"; unit_item_id: string }
  | { type: "hub_donation"; campaign_id: string; amount_pence: number; message?: string | null; anonymous?: boolean; gift_aid?: unknown }
  | { type: "hub_membership"; membership_type_id: string }
  | { type: "analytics_addon"; business_id: string }
  | { type: "shift_boost"; shift_id: string };

export async function walletCheckout(
  body: WalletCheckoutBody,
): Promise<{ ok: boolean; balance_pence: number; purchase_id?: string; uses_remaining?: number; expires_at?: string | null; member_no?: string | null; paid_until?: string | null }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("wallet-checkout", { body });
  if (error) return invokeError(error);
  return data;
}

/* ── Claim an offer (not a payment — records a single-use claim) ──────────────── */

export async function claimOffer(offerId: string): Promise<{ ok: boolean; already?: boolean }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("local-redeem-offer", {
    body: { offer_id: offerId },
  });
  if (error) {
    // The single-use PK collision surfaces as a 409 — treat as already-claimed.
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 409) return { ok: true, already: true };
    return invokeError(error);
  }
  return { ...(data as { ok: boolean }), already: false };
}

/* ── Claim a gift ──────────────────────────────────────────────────────────────
   Mirrors the app (oneshetland-delivers/app/g/[code].tsx): the claim is a Postgres
   RPC `claim_gift({ p_code })`, NOT an edge function. It returns
   { kind, service_id, business_id }:
     • unit gift    → server spawns the book_unit_purchases row, gift status='used'
                      (appears under Passes); nothing more to do client-side.
     • booking gift → gift status='claimed'; the recipient still needs to pick a
                      slot, booking with this gift's id attached.
   Errors arrive as thrown messages: gift_already_claimed, gift_expired,
   gift_not_paid, gift_cancelled, gift_not_found, auth_required.                    */

export interface GiftClaimResult {
  kind: "unit" | "booking";
  service_id: string | null;
  business_id: string;
}

export async function claimGift(code: string): Promise<GiftClaimResult> {
  const sb = createClient();
  const { data, error } = await sb.rpc("claim_gift", { p_code: code });
  if (error) throw new Error(error.message);
  return data as GiftClaimResult;
}

/* ── My loyalty card for one business ───────────────────────────────────────────
   Web mirror of the app's fetchMyLoyaltyCard (oneshetland-delivers/lib/local-api).
   Table: local_loyalty_cards (user_id, business_id, stamps_collected, points_balance). */

export interface MyLoyaltyCard {
  id: string;
  stamps_collected: number;
  points_balance: number;
}

export async function fetchMyLoyaltyCard(businessId: string): Promise<MyLoyaltyCard | null> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data } = await sb
    .from("local_loyalty_cards")
    .select("id, stamps_collected, points_balance")
    .eq("user_id", auth.user.id)
    .eq("business_id", businessId)
    .maybeSingle();
  return (data ?? null) as MyLoyaltyCard | null;
}

/* ── My already-claimed offer ids (per-user, client-side) ─────────────────────── */

export async function fetchMyRedeemedOfferIds(): Promise<string[]> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  const { data } = await sb
    .from("local_offer_redemptions")
    .select("offer_id")
    .eq("user_id", auth.user.id);
  return (data ?? []).map((r: { offer_id: string }) => r.offer_id);
}
