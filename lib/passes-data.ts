"use client";

import { createClient } from "@/lib/supabase/client";

/* ──────────────────────────────────────────────────────────────────────────────
   Passes & received gifts — web mirror of the app's lib/local-api.ts
   (oneshetland-delivers): fetchMyPasses + fetchMyGiftsReceived.

   • Passes  → book_unit_purchases owned by the user (uses_remaining > 0, unexpired)
   • Gifts   → book_gifts where claimed_by_user_id = me, status in (claimed, used)

   Unit gifts become book_unit_purchases rows as soon as they're claimed (so they
   show under Passes, not Gifts). Booking gifts stay in Gifts with status='claimed'
   until the recipient picks a slot.                                                */

export interface MyPass {
  id: string;
  item_id: string;
  business_id: string;
  uses_remaining: number;
  paid_amount_pence: number;
  expires_at: string | null;
  created_at: string;
  item_name: string | null;
  business_name: string | null;
  /** True if this purchase was acquired by claiming a gift. */
  from_gift: boolean;
  /** The gift this pass came from, so a claimed gift can point at it. */
  gift_id: string | null;
  fully_used_at: string | null;
  /**
   * A purchase is an entitlement while it lasts and a receipt for ever after.
   *
   * The query used to ask only the first question — .gt("uses_remaining", 0)
   * plus an unexpired filter — so a pass vanished from the customer's account
   * the moment they finished using it, and the page said "Nothing yet" to
   * somebody who had bought and used one that afternoon.
   */
  status: "active" | "used" | "expired";
}

function classify(usesRemaining: number, expiresAt: string | null): MyPass["status"] {
  if (usesRemaining <= 0) return "used";
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

export async function fetchMyPasses(): Promise<MyPass[]> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  // Everything this person has ever bought. Owner-scoped by the same
  // owner_id filter and the same RLS as before — the two filters removed here
  // were about USABILITY, not access, and they belong in the rendering.
  const { data, error } = await sb
    .from("book_unit_purchases")
    .select(
      `id, item_id, business_id, uses_remaining, paid_amount_pence,
       expires_at, created_at, gift_id, fully_used_at,
       item:book_unit_items ( name ),
       business:local_businesses ( name )`,
    )
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    item_id: r.item_id as string,
    business_id: r.business_id as string,
    uses_remaining: r.uses_remaining as number,
    paid_amount_pence: r.paid_amount_pence as number,
    expires_at: (r.expires_at as string | null) ?? null,
    created_at: r.created_at as string,
    item_name: (r.item as { name?: string } | null)?.name ?? null,
    business_name: (r.business as { name?: string } | null)?.name ?? null,
    from_gift: !!r.gift_id,
    gift_id: (r.gift_id as string | null) ?? null,
    fully_used_at: (r.fully_used_at as string | null) ?? null,
    status: classify(r.uses_remaining as number, (r.expires_at as string | null) ?? null),
  }));
}

export interface MyGiftReceived {
  id: string;
  code: string;
  kind: "unit" | "booking";
  status: "claimed" | "used";
  business_id: string;
  business_name: string | null;
  service_id: string | null;
  service_name: string | null;
  unit_item_id: string | null;
  unit_item_name: string | null;
  purchaser_name: string | null;
  message: string | null;
  claimed_at: string;
  expires_at: string | null;
  /**
   * Booking gifts only: the recipient has already picked their slot.
   *
   * Derived from book_bookings, NOT from book_gifts.status. claim_gift() sets
   * status='claimed' and only a UNIT gift ever reaches 'used'; the write that
   * was meant to mark a booked service gift as used sits in createBooking and
   * silently affects no rows, because book_gifts has SELECT policies only and
   * no UPDATE policy at all. So status alone leaves a booked gift showing
   * "Pick a time" forever. The booking row is the authoritative record, and
   * the claimer can read their own by "Customers see their own bookings".
   */
  booked: boolean;
}

/**
 * Gifts addressed to the signed-in user's CONFIRMED auth email that are sent,
 * unclaimed and unexpired.
 *
 * A separate read because it answers a different question. book_gifts has no
 * recipient SELECT policy — only business owner, purchaser and CLAIMER — so a
 * recipient was invisible to themselves until they claimed, which is what they
 * came to the page to do. my_unclaimed_gifts() is a SECURITY DEFINER function
 * returning display fields only: never the claim code, the payment intent or
 * the purchaser. See migration 20260930120000.
 */
export type ReadyToClaimGift = {
  gift_id: string;
  kind: "unit" | "booking";
  product_name: string | null;
  business_name: string | null;
  sender_name: string | null;
  message: string | null;
  expires_at: string | null;
  created_at: string;
};

export async function fetchMyReadyToClaimGifts(): Promise<ReadyToClaimGift[]> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await sb.rpc("my_unclaimed_gifts");
  if (error) throw error;
  return (data ?? []) as ReadyToClaimGift[];
}

/**
 * Claim one of them. The gift's code is never sent to the browser — the server
 * resolves it and delegates to claim_gift, so gift_recipient_ok stays the one
 * authorisation gate. A gift id names a gift; it does not authorise claiming it.
 */
export async function claimGiftById(giftId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.rpc("claim_gift_by_id", { p_gift_id: giftId });
  if (error) throw new Error(error.message);
}

export async function fetchMyGiftsReceived(): Promise<MyGiftReceived[]> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await sb
    .from("book_gifts")
    .select(
      `id, code, kind, status, business_id, service_id, unit_item_id,
       purchaser_name, message, claimed_at, expires_at,
       business:local_businesses ( name ),
       service:book_services ( name ),
       unit_item:book_unit_items ( name )`,
    )
    .eq("claimed_by_user_id", auth.user.id)
    .in("status", ["claimed", "used"])
    .order("claimed_at", { ascending: false });
  if (error) throw error;

  const rows: MyGiftReceived[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    code: r.code as string,
    kind: r.kind as "unit" | "booking",
    status: r.status as "claimed" | "used",
    business_id: r.business_id as string,
    business_name: (r.business as { name?: string } | null)?.name ?? null,
    service_id: (r.service_id as string | null) ?? null,
    service_name: (r.service as { name?: string } | null)?.name ?? null,
    unit_item_id: (r.unit_item_id as string | null) ?? null,
    unit_item_name: (r.unit_item as { name?: string } | null)?.name ?? null,
    purchaser_name: (r.purchaser_name as string | null) ?? null,
    message: (r.message as string | null) ?? null,
    claimed_at: r.claimed_at as string,
    expires_at: (r.expires_at as string | null) ?? null,
    booked: false,
  }));

  // Which of these booking gifts already have a slot? One extra query rather
  // than one per gift, and only for the gifts that could need it.
  const bookingGiftIds = rows.filter((g) => g.kind === "booking").map((g) => g.id);
  if (bookingGiftIds.length > 0) {
    const { data: booked } = await sb
      .from("book_bookings")
      .select("gift_id")
      .in("gift_id", bookingGiftIds)
      .neq("status", "cancelled");
    const bookedIds = new Set((booked ?? []).map((b) => (b as { gift_id: string }).gift_id));
    for (const g of rows) if (bookedIds.has(g.id)) g.booked = true;
  }

  return rows;
}

/* ── Gifts I have SENT ────────────────────────────────────────────────────────
   book_gifts where purchaser_id = me. The "Purchasers see their gifts" policy
   has always permitted this read; there was simply no screen asking for it, so
   a buyer's own gift history had nowhere to live.

   Deliberately NOT selected: claimed_by_user_id, recipient_email,
   payment_intent_id, code. The sender sees what they bought, who they sent it
   to by the name THEY typed, and how far it has got — not the recipient's
   account, and not the bearer token.                                          */

export interface MyGiftSent {
  id: string;
  kind: "unit" | "booking";
  status: "sent" | "claimed" | "used" | "cancelled";
  business_name: string | null;
  item_name: string | null;
  recipient_name: string | null;
  message: string | null;
  price_paid_pence: number;
  created_at: string;
  claimed_at: string | null;
  expires_at: string | null;
  /** True when the purchaser claimed their own gift — see the self-gift note. */
  claimed_by_me: boolean;
}

export async function fetchMyGiftsSent(): Promise<MyGiftSent[]> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await sb
    .from("book_gifts")
    .select(
      `id, kind, status, price_paid_pence, recipient_name, message,
       created_at, claimed_at, expires_at, claimed_by_user_id,
       business:local_businesses ( name ),
       service:book_services ( name ),
       unit_item:book_unit_items ( name )`,
    )
    .eq("purchaser_id", auth.user.id)
    // A gift whose payment never completed was never sent.
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    kind: r.kind as "unit" | "booking",
    status: r.status as MyGiftSent["status"],
    business_name: (r.business as { name?: string } | null)?.name ?? null,
    item_name:
      r.kind === "unit"
        ? (r.unit_item as { name?: string } | null)?.name ?? null
        : (r.service as { name?: string } | null)?.name ?? null,
    recipient_name: (r.recipient_name as string | null) ?? null,
    message: (r.message as string | null) ?? null,
    price_paid_pence: (r.price_paid_pence as number) ?? 0,
    created_at: r.created_at as string,
    claimed_at: (r.claimed_at as string | null) ?? null,
    expires_at: (r.expires_at as string | null) ?? null,
    claimed_by_me: r.claimed_by_user_id === auth.user!.id,
  }));
}

/* Public preview of a gift by code — for the /g/[code] claim page. Runs while
   logged out so the recipient sees what they're claiming before signing in.      */

/**
 * What a signed-out visitor is shown behind a /g/<code> link.
 *
 * Deliberately narrower than the book_gifts row. There is no id, no
 * business_id, no service_id, no purchaser identity and no payment field —
 * the claim RPC returns the ids the claim flow needs, so the anonymous
 * preview never has to carry them.
 */
export interface GiftPreview {
  code: string;
  kind: "unit" | "booking";
  status: string;
  business_name: string;
  item_name: string;
  purchaser_name: string | null;
  message: string | null;
  expires_at: string | null;
}

export async function fetchGiftPreview(code: string): Promise<GiftPreview | null> {
  const sb = createClient();
  // get_public_gift_preview, not a table read: book_gifts has no public SELECT
  // policy and must not get one. Possession of the 14-character code is the
  // access rule, and only this RPC is allowed to act on it.
  const { data, error } = await sb.rpc("get_public_gift_preview", { p_code: code });
  if (error) {
    console.error(`[gift-preview] lookup failed — ${error.code ?? "?"}: ${error.message}`);
    return null;
  }
  const row = (data as GiftPreview[] | null)?.[0];
  if (!row) return null;
  return { ...row, code };
}
