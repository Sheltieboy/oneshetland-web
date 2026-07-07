"use client";

import { createClient } from "@/lib/supabase/client";

/* ── Types (subset mirrored from the app's book-api.ts) ───────────────────────── */

export interface BookAvailabilityRule {
  id: string;
  business_id: string;
  service_id: string | null; // null = applies to all services
  day_of_week: number; // 0 = Sun, 6 = Sat
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  slot_interval_minutes: number;
  is_active: boolean;
}

export type BookOverrideType = "open" | "closed" | "last_min";

export interface BookSlotOverride {
  id: string;
  business_id: string;
  service_id: string | null;
  starts_at: string;
  ends_at: string;
  type: BookOverrideType;
  notes: string | null;
}

export type BookingStatus = "pending_payment" | "confirmed" | "cancelled" | "no_show" | "completed";

export interface BookBooking {
  id: string;
  business_id: string;
  service_id: string;
  customer_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
}

/** A customer's booking row, joined with service + business for "My bookings". */
export interface MyBooking {
  id: string;
  business_id: string;
  service_id: string;
  customer_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  price_pence: number;
  deposit_pence: number;
  notes: string | null;
  created_at: string;
  // joined
  service: { name: string; duration_minutes: number; price_pence: number } | null;
  business: { id: string; name: string; logo_url: string | null; address: string | null; phone: string | null } | null;
}

/* ── Reads ────────────────────────────────────────────────────────────────────── */

export async function fetchAvailabilityRules(businessId: string): Promise<BookAvailabilityRule[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from("book_availability_rules")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookAvailabilityRule[];
}

export async function fetchUpcomingOverrides(businessId: string, fromIso?: string): Promise<BookSlotOverride[]> {
  const sb = createClient();
  const from = fromIso ?? new Date().toISOString();
  const { data, error } = await sb
    .from("book_slot_overrides")
    .select("*")
    .eq("business_id", businessId)
    .gte("starts_at", from)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookSlotOverride[];
}

/** Public, PII-free booking load via the get_public_booking_load SECURITY DEFINER fn. */
export async function fetchPublicBookings(
  businessId: string,
  fromIso?: string,
  toIso?: string,
): Promise<BookBooking[]> {
  const sb = createClient();
  const { data, error } = await sb.rpc("get_public_booking_load", {
    p_business_id: businessId,
    p_from: fromIso ?? null,
    p_to: toIso ?? null,
  });
  if (error) {
    console.warn("[fetchPublicBookings] failed:", error.message);
    return [];
  }
  return ((data ?? []) as { id: string; service_id: string; starts_at: string; ends_at: string; status: string }[]).map(
    (r): BookBooking => ({
      id: r.id,
      business_id: businessId,
      service_id: r.service_id,
      customer_id: "",
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      status: r.status as BookingStatus,
    }),
  );
}

/**
 * The signed-in customer's own bookings, newest first (starts_at desc).
 * Mirrors the app's `fetchMyBookings` (lib/book-api.ts): joins the service
 * name/duration/price and the business name/logo/address/phone. Returns []
 * when logged out.
 */
export async function fetchMyBookings(): Promise<MyBooking[]> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await sb
    .from("book_bookings")
    .select(
      `*,
       service:book_services ( name, duration_minutes, price_pence ),
       business:local_businesses ( id, name, logo_url, address, phone )`,
    )
    .eq("customer_id", auth.user.id)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MyBooking[];
}

/**
 * Customer-cancels their own booking. Sets status='cancelled', cancelled_at,
 * cancelled_by, then fires the notify-booking edge function (fire-and-forget).
 * Mirrors the app's `cancelBooking`.
 */
export async function cancelBooking(id: string): Promise<void> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("You need to be signed in to cancel a booking.");

  const { error } = await sb
    .from("book_bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: auth.user.id,
    })
    .eq("id", id);
  if (error) throw error;

  // Notify the business owner (fire-and-forget).
  sb.functions.invoke("notify-booking", { body: { booking_id: id, event: "cancelled" } }).catch(() => {});
}

/* ── Create booking (create-only, no charge — parity with the app's Phase-3 stub) ── */

export interface CreateBookingInput {
  businessId: string;
  serviceId: string;
  customerId: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  pricePence: number;
  depositPence: number;
  notes?: string | null;
  giftId?: string | null; // set when this booking was paid via a gift
}

/** Capacity-aware availability check — mirrors the app's isSlotAvailable. */
async function isSlotAvailable(businessId: string, serviceId: string, startsAt: string, endsAt: string): Promise<boolean> {
  const sb = createClient();
  const { data: svc, error: svcErr } = await sb.from("book_services").select("capacity").eq("id", serviceId).maybeSingle();
  if (svcErr) throw svcErr;
  const capacity = (svc as { capacity?: number } | null)?.capacity ?? 1;

  const { count, error } = await sb
    .from("book_bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("service_id", serviceId)
    .in("status", ["confirmed", "pending_payment"])
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt);
  if (error) throw error;
  return (count ?? 0) < capacity;
}

export async function createBooking(input: CreateBookingInput): Promise<{ id: string }> {
  const sb = createClient();
  const free = await isSlotAvailable(input.businessId, input.serviceId, input.startsAt, input.endsAt);
  if (!free) throw new Error("Sorry — that slot is now full. Please pick another.");

  const { data, error } = await sb
    .from("book_bookings")
    .insert({
      business_id: input.businessId,
      service_id: input.serviceId,
      customer_id: input.customerId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      price_pence: input.pricePence,
      deposit_pence: input.depositPence,
      notes: input.notes ?? null,
      status: "confirmed",
      gift_id: input.giftId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  // If this booking was paid by a gift, mark the gift as used (mirrors the app's book-api.ts).
  if (input.giftId) {
    await sb
      .from("book_gifts")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", input.giftId);
  }

  // Notify the business owner (fire-and-forget).
  sb.functions.invoke("notify-booking", { body: { booking_id: (data as { id: string }).id, event: "created" } }).catch(() => {});

  return data as { id: string };
}
