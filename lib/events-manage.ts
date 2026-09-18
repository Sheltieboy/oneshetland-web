/**
 * events-manage.ts — server fetchers for the business event organiser area.
 *
 * Additive to events-data.ts; kept separate to avoid conflicts. Mirrors the
 * app's events-api fetchBusinessEvents / fetchEvent / fetchScannerStats.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { EventStatus, EventUpdate } from "./events-data";

export type ManageTicketType = {
  id: string;
  name: string;
  price_pence: number;
  description: string | null;
  quantity_available: number | null;
  quantity_sold: number;
  per_order_max: number;
  is_active: boolean;
  display_order: number;
};

/* DEFAULT_PER_ORDER_MAX and ticketCapacity live in the client-safe
   event-ticket-utils, because Client Components need them and this module
   reaches next/headers. Re-exported so there is still one definition. */
export { DEFAULT_PER_ORDER_MAX, ticketCapacity } from "./event-ticket-utils";

// eventHasActivePaidTicket lives in the client-safe events-manage-client.ts,
// for the same reason, and is NOT re-exported from here: even a re-export
// pulls this whole module's next/headers-reaching createServerClient import
// into any client bundle that imports it. BusinessEventManage.tsx ("use
// client") imports it directly from events-manage-client.ts instead.

/** Row in the business's event list. */
export type BusinessEventRow = {
  id: string;
  title: string;
  status: EventStatus;
  category: string | null;
  venue: string | null;
  locality: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  has_tickets: boolean;
  ticket_url: string | null;
  tickets_sold: number;
};

/** Full event for the organiser manage + edit screens. */
export type ManageEvent = {
  id: string;
  organiser_business_id: string | null;
  organiser_hub_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: EventStatus;
  venue: string | null;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  formatted_address: string | null;
  starts_at: string;
  ends_at: string | null;
  doors_open_at: string | null;
  capacity: number | null;
  tickets_sold: number;
  has_tickets: boolean;
  cover_url: string | null;
  ticket_url: string | null;
  age_restriction: string | null;
  refund_policy: string | null;
  contact_info: string | null;
  event_notes: string | null;
  ticket_types: ManageTicketType[];
  updates: EventUpdate[];
  /**
   * From event_payout_ready(uuid) — the same canonical signal the buyer-side
   * event page and mobile's Event Manage screen already read (see
   * supabase/migrations/20260822120000_effective_event_payout.sql). Used
   * here only to decide what Event Manage SHOWS (the publish action, the
   * not-published banner) — not a new gate. The actual publish action still
   * goes through setEventStatus unconditionally; money itself can't move
   * without a real payout route regardless of what this screen displays.
   */
  payout_ready: boolean;
};

/** Sales / check-in stats for an event. */
export type EventSalesStats = {
  tickets_sold: number;
  checked_in: number;
  pending_payment: number;
  revenue_pence: number;
};

const LIST_COLS =
  "id, title, status, category, venue, locality, starts_at, ends_at, cover_url, has_tickets, ticket_url, tickets_sold";

const DETAIL_COLS = `
  id, organiser_business_id, organiser_hub_id, title, description, category, status,
  venue, locality, lat, lng, place_id, formatted_address, starts_at, ends_at, doors_open_at,
  capacity, tickets_sold, has_tickets, cover_url, ticket_url, age_restriction, refund_policy,
  contact_info, event_notes,
  ticket_types:event_ticket_types(id,name,price_pence,description,quantity_available,quantity_sold,per_order_max,is_active,display_order),
  updates:event_updates(id,title,body,kind,is_urgent,created_at)
`;

/** Every event organised by this business (all statuses), newest first. */
export async function getBusinessEvents(businessId: string): Promise<BusinessEventRow[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("events")
    .select(LIST_COLS)
    .eq("organiser_business_id", businessId)
    .order("starts_at", { ascending: false });
  return (data ?? []) as unknown as BusinessEventRow[];
}

/** A single event owned by this business, with ticket types + updates. */
export async function getBusinessEvent(businessId: string, eventId: string): Promise<ManageEvent | null> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("events")
    .select(DETAIL_COLS)
    .eq("id", eventId)
    .eq("organiser_business_id", businessId)
    .maybeSingle();
  if (!data) return null;
  const ev = data as Record<string, unknown>;

  const tt = (ev.ticket_types as ManageTicketType[]) ?? [];
  tt.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const updates = (ev.updates as EventUpdate[]) ?? [];
  updates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Fails closed: an unreadable answer is "not ready", never a guess that
  // it is — matches every other payout-readiness read in this codebase.
  let payoutReady = false;
  try {
    const { data: ready } = await sb.rpc("event_payout_ready", { p_event_id: eventId });
    payoutReady = ready === true;
  } catch {
    payoutReady = false;
  }

  return { ...(ev as unknown as ManageEvent), ticket_types: tt, updates, payout_ready: payoutReady };
}

/**
 * Sales + check-in stats. Prefers the same RPC the app uses
 * (get_event_scanner_stats); falls back to counting tickets directly when the
 * RPC is unavailable. Revenue is summed from paid orders.
 */
export async function getEventSalesStats(eventId: string): Promise<EventSalesStats> {
  const sb = await createServerClient();

  let tickets_sold = 0;
  let checked_in = 0;
  let pending_payment = 0;

  const { data: rpc, error: rpcErr } = await sb.rpc("get_event_scanner_stats", { p_event_id: eventId });
  if (!rpcErr && rpc) {
    const s = rpc as { tickets_sold?: number; checked_in?: number; pending_payment?: number };
    tickets_sold = s.tickets_sold ?? 0;
    checked_in = s.checked_in ?? 0;
    pending_payment = s.pending_payment ?? 0;
  } else {
    // Fallback: count tickets by status.
    const [valid, used, pending] = await Promise.all([
      sb.from("event_tickets").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "valid"),
      sb.from("event_tickets").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "used"),
      sb.from("event_tickets").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "pending_payment"),
    ]);
    checked_in = used.count ?? 0;
    tickets_sold = (valid.count ?? 0) + checked_in;
    pending_payment = pending.count ?? 0;
  }

  // Revenue from paid orders (best-effort).
  let revenue_pence = 0;
  try {
    const { data: orders } = await sb
      .from("event_ticket_orders")
      .select("total_pence")
      .eq("event_id", eventId)
      .eq("status", "paid");
    revenue_pence = (orders ?? []).reduce((sum, o) => sum + ((o as { total_pence: number }).total_pence ?? 0), 0);
  } catch {
    revenue_pence = 0;
  }

  return { tickets_sold, checked_in, pending_payment, revenue_pence };
}
