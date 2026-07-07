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
}

export async function fetchMyPasses(): Promise<MyPass[]> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("book_unit_purchases")
    .select(
      `id, item_id, business_id, uses_remaining, paid_amount_pence,
       expires_at, created_at, gift_id,
       item:book_unit_items ( name ),
       business:local_businesses ( name )`,
    )
    .eq("owner_id", auth.user.id)
    .gt("uses_remaining", 0)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
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

  return (data ?? []).map((r: Record<string, unknown>) => ({
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
  }));
}

/* Public preview of a gift by code — for the /g/[code] claim page. Runs while
   logged out so the recipient sees what they're claiming before signing in.      */

export interface GiftPreview {
  id: string;
  code: string;
  kind: "unit" | "booking";
  status: string;
  business_id: string;
  business_name: string;
  item_name: string;
  purchaser_name: string | null;
  message: string | null;
  unit_item_id: string | null;
  service_id: string | null;
}

export async function fetchGiftPreview(code: string): Promise<GiftPreview | null> {
  const sb = createClient();
  const { data, error } = await sb
    .from("book_gifts")
    .select(
      `id, code, kind, status, business_id, unit_item_id, service_id,
       purchaser_name, message,
       business:local_businesses ( name ),
       unit_item:book_unit_items ( name ),
       service:book_services ( name )`,
    )
    .eq("code", code)
    .maybeSingle();
  if (error || !data) return null;

  const r = data as Record<string, unknown>;
  const businessName = (r.business as { name?: string } | null)?.name ?? "OneShetland";
  const itemName =
    r.kind === "unit"
      ? (r.unit_item as { name?: string } | null)?.name ?? "a unit"
      : (r.service as { name?: string } | null)?.name ?? "a booking";

  return {
    id: r.id as string,
    code: r.code as string,
    kind: r.kind as "unit" | "booking",
    status: r.status as string,
    business_id: r.business_id as string,
    business_name: businessName,
    item_name: itemName,
    purchaser_name: (r.purchaser_name as string | null) ?? null,
    message: (r.message as string | null) ?? null,
    unit_item_id: (r.unit_item_id as string | null) ?? null,
    service_id: (r.service_id as string | null) ?? null,
  };
}
