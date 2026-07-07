"use client";

/**
 * book-owner.ts — browser-side reads/writes for the owner's incoming-bookings
 * dashboard on the web portal. Mirrors the app's lib/book-api.ts owner actions
 * (fetchBusinessBookings / updateBookingStatus / cancelBooking) so behaviour
 * matches: same select shape, same status values, same notify-booking event.
 */

import { createClient } from "@/lib/supabase/client";

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "no_show"
  | "completed";

export interface OwnerBooking {
  id: string;
  business_id: string;
  service_id: string;
  customer_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  price_pence: number;
  deposit_pence: number;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  service?: { name: string | null; duration_minutes: number | null; price_pence: number | null } | null;
  customer?: { full_name: string | null } | null;
}

/** £25.00 / "Price on request" — matches the app's formatPence. */
export function formatPence(pence: number): string {
  if (pence === 0) return "Price on request";
  return `£${(pence / 100).toFixed(2)}`;
}

/** Owner's incoming bookings, 30 days back + all future. */
export async function fetchBusinessBookings(businessId: string): Promise<OwnerBooking[]> {
  const sb = createClient();
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await sb
    .from("book_bookings")
    .select(`
      *,
      service:book_services ( name, duration_minutes, price_pence ),
      customer:profiles!book_bookings_customer_id_fkey ( full_name )
    `)
    .eq("business_id", businessId)
    .gte("starts_at", from)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OwnerBooking[];
}

/** Owner action: mark a booking complete / no-show / confirmed / cancelled. */
export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("book_bookings").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Owner cancels a booking: sets cancelled + notifies the customer. */
export async function cancelBookingAsOwner(id: string): Promise<void> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb
    .from("book_bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user?.id ?? null,
    })
    .eq("id", id);
  if (error) throw error;

  // Notify the customer (same edge fn the app uses). Fire-and-forget.
  sb.functions.invoke("notify-booking", { body: { booking_id: id, event: "cancelled" } }).catch(() => {});
}
