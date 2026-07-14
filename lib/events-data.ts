import { publicClient } from "./supabase/public";

// Full static category set — mirrors the app's EVENT_CATEGORIES (lib/events-api.ts),
// including "Business". The public listing shows all of these regardless of which
// are currently present in the data.
export const EVENT_CATEGORIES = [
  "Music",
  "Arts & Culture",
  "Market",
  "Community",
  "Outdoors",
  "Sport",
  "Family",
  "Food & Drink",
  "Charity",
  "Business",
  "Festival",
  "Other",
] as const;

export type Organiser = { id: string; name: string; logo_url: string | null; brand_color?: string | null } | null;

/** Minimal ticket pricing carried on list rows so the public listing can label
 *  prices and drive the "Free only" filter without a per-event fetch. */
export type ListTicketType = { price_pence: number; is_active: boolean };

export type EventListItem = {
  id: string;
  title: string;
  category: string | null;
  venue: string | null;
  locality: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  price_text: string | null;
  has_tickets: boolean;
  is_featured: boolean;
  business: Organiser;
  hub: Organiser;
  ticket_types: ListTicketType[];
};

export type EventStatus = "draft" | "published" | "cancelled" | "postponed" | "archived";

export type TicketType = {
  id: string;
  name: string;
  price_pence: number;
  description: string | null;
  quantity_available: number | null;
  quantity_sold: number;
  is_active: boolean;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
};

export type EventUpdateKind =
  | "info"
  | "urgent"
  | "cancellation"
  | "venue_change"
  | "time_change"
  | "weather"
  | "entry_info";

export type EventUpdate = {
  id: string;
  title: string;
  body: string;
  kind: EventUpdateKind;
  is_urgent: boolean;
  created_at: string;
};

export const UPDATE_KIND_LABELS: Record<EventUpdateKind, string> = {
  info: "Update",
  urgent: "Urgent",
  cancellation: "Cancellation",
  venue_change: "Venue change",
  time_change: "Time change",
  weather: "Weather",
  entry_info: "Entry info",
};

export type EventDetail = Omit<EventListItem, "ticket_types"> & {
  status: EventStatus;
  description: string | null;
  doors_open_at: string | null;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
  accessibility_info: string | null;
  age_restriction: string | null;
  contact_info: string | null;
  event_notes: string | null;
  refund_policy: string | null;
  ticket_url: string | null;
  gallery_urls: string[] | null;
  ticket_types: TicketType[];
  updates: EventUpdate[];
};

/** Whether a ticket type is currently purchasable. Mirrors the app's
 *  ticketTypeOnSale() — active, within sale window, and not sold out. */
export function ticketTypeOnSale(t: TicketType): boolean {
  const now = new Date().toISOString();
  if (!t.is_active) return false;
  if (t.sale_starts_at && t.sale_starts_at > now) return false;
  if (t.sale_ends_at && t.sale_ends_at < now) return false;
  if (t.quantity_available !== null && t.quantity_sold >= t.quantity_available) return false;
  return true;
}

/** Tickets remaining for a type, or null when no cap is set. */
export function ticketTypeRemaining(t: TicketType): number | null {
  return t.quantity_available === null ? null : Math.max(0, t.quantity_available - t.quantity_sold);
}

export interface EventScarcity {
  /** true only when there is a real, capped allocation to measure against. */
  measurable: boolean;
  totalCap: number;
  totalSold: number;
  remaining: number;
  /** 0..100, rounded. */
  pctSold: number;
  soldOut: boolean;
  /** ≥65% sold — the honest "selling fast" threshold. */
  sellingFast: boolean;
  /** true when the (capped) allocation is nearly gone. */
  almostGone: boolean;
}

/**
 * Aggregate scarcity across an event's capped, active ticket types. Uncapped
 * tiers are ignored (we can't measure "% gone" without a cap). Honest data only.
 */
export function computeScarcity(ticketTypes: TicketType[]): EventScarcity {
  const capped = ticketTypes.filter((t) => t.is_active && t.quantity_available !== null);
  const none: EventScarcity = {
    measurable: false, totalCap: 0, totalSold: 0, remaining: 0,
    pctSold: 0, soldOut: false, sellingFast: false, almostGone: false,
  };
  if (capped.length === 0) return none;
  const totalCap = capped.reduce((n, t) => n + (t.quantity_available ?? 0), 0);
  const totalSold = capped.reduce((n, t) => n + Math.min(t.quantity_sold, t.quantity_available ?? 0), 0);
  if (totalCap <= 0) return none;
  const remaining = Math.max(0, totalCap - totalSold);
  const pctSold = Math.round((totalSold / totalCap) * 100);
  return {
    measurable: true,
    totalCap,
    totalSold,
    remaining,
    pctSold,
    soldOut: remaining === 0,
    sellingFast: pctSold >= 65 && remaining > 0,
    almostGone: remaining > 0 && remaining <= 10,
  };
}

export interface EventSocialStats {
  /** Valid + used tickets issued for this event. */
  goingCount: number;
  /** Tickets booked in the last 24h — powers the urgency line. */
  bookedRecent: number;
}

/** Public aggregate stats (counts only, no PII) via the get_event_social_stats RPC. */
export async function getEventSocialStats(eventId: string): Promise<EventSocialStats> {
  const sb = publicClient();
  const { data, error } = await sb.rpc("get_event_social_stats", { p_event_id: eventId });
  if (error || !data) return { goingCount: 0, bookedRecent: 0 };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    goingCount: Number(row?.going_count ?? 0),
    bookedRecent: Number(row?.booked_recent ?? 0),
  };
}

/* ── Pricing helpers (mirror the app's events-api) ─────────────────────────── */

/** Lowest paid (>0) active ticket price in pence, or null when none. */
export function lowestTicketPrice(types: ListTicketType[]): number | null {
  const active = types.filter((t) => t.is_active && t.price_pence > 0);
  if (active.length === 0) return null;
  return Math.min(...active.map((t) => t.price_pence));
}

/** A list row is "free" using the same rule the app applies in its Free-only
 *  filter: no tickets at all, OR ticket types exist and every one is £0, OR
 *  (no ticket types) no free-text price. */
export function isFreeListEvent(e: EventListItem): boolean {
  if (!e.has_tickets) return true;
  if (e.ticket_types.length > 0) return e.ticket_types.every((t) => t.price_pence === 0);
  return !e.price_text;
}

/** Display price label for a list row, matching the app's EventCard logic. */
export function priceLabel(e: EventListItem): string | null {
  if (!e.has_tickets) return e.price_text ?? null;
  if (e.ticket_types.length > 0) {
    if (e.ticket_types.every((t) => t.price_pence === 0)) return "Free";
    const low = lowestTicketPrice(e.ticket_types);
    return low !== null ? `From £${(low / 100).toFixed(2)}` : null;
  }
  return e.price_text ?? null;
}

const LIST_COLS =
  "id, title, category, venue, locality, starts_at, ends_at, cover_url, price_text, has_tickets, is_featured, organiser_hub_id, business:local_businesses(id,name,logo_url), hub:hubs(id,name,logo_url,brand_color), ticket_types:event_ticket_types(price_pence,is_active)";

export type DateRange = "today" | "week" | "month" | "all";

/** Compute the upper bound (ISO) for a date-range filter, relative to now. */
function rangeTo(range: DateRange): string | undefined {
  if (range === "all") return undefined;
  const d = new Date();
  if (range === "today") {
    d.setHours(23, 59, 59, 999);
  } else if (range === "week") {
    // End of the current week (through Sunday) — a calendar week, not "next 7 days".
    const daysToSunday = (7 - d.getDay()) % 7;
    d.setDate(d.getDate() + daysToSunday);
    d.setHours(23, 59, 59, 999);
  } else if (range === "month") {
    // End of the current calendar month — so "This month" (July) excludes August.
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  }
  return d.toISOString();
}

/**
 * Upcoming published events (islands-wide), with optional category, date-range
 * and pagination. Mirrors the app's fetchPublishedEvents range semantics
 * (starts_at between now and the range upper bound).
 */
export async function getUpcomingEvents(
  opts: { category?: string; range?: DateRange; limit?: number; offset?: number } = {},
): Promise<EventListItem[]> {
  const sb = publicClient();
  const now = new Date().toISOString();
  const limit = opts.limit ?? 80;
  let q = sb
    .from("events")
    .select(LIST_COLS)
    .eq("status", "published")
    .or("organiser_hub_id.is.null,calendar_approved.eq.true")
    .gte("starts_at", now)
    .order("starts_at", { ascending: true });
  const to = rangeTo(opts.range ?? "all");
  if (to) q = q.lte("starts_at", to);
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.offset) {
    q = q.range(opts.offset, opts.offset + limit - 1);
  } else {
    q = q.limit(limit);
  }
  try {
    const { data } = await q;
    return (data ?? []).map((r) => ({
      ...(r as unknown as EventListItem),
      ticket_types: ((r as { ticket_types?: ListTicketType[] }).ticket_types ?? []),
    }));
  } catch {
    return [];
  }
}

/** All upcoming events within a calendar month [first, last], for the month grid. */
export async function getEventsInMonth(year: number, month: number): Promise<EventListItem[]> {
  const sb = publicClient();
  const from = new Date(year, month, 1).toISOString();
  const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
  try {
    const { data } = await sb
      .from("events")
      .select(LIST_COLS)
      .eq("status", "published")
      .or("organiser_hub_id.is.null,calendar_approved.eq.true")
      .gte("starts_at", from)
      .lte("starts_at", to)
      .order("starts_at", { ascending: true })
      .limit(300);
    return (data ?? []).map((r) => ({
      ...(r as unknown as EventListItem),
      ticket_types: ((r as { ticket_types?: ListTicketType[] }).ticket_types ?? []),
    }));
  } catch {
    return [];
  }
}

/** The distinct categories actually present in upcoming published events. */
export async function getEventCategories(): Promise<string[]> {
  const sb = publicClient();
  const now = new Date().toISOString();
  try {
    const { data } = await sb
      .from("events")
      .select("category")
      .eq("status", "published")
      .or("organiser_hub_id.is.null,calendar_approved.eq.true")
      .gte("starts_at", now)
      .not("category", "is", null);
    const set = new Set<string>();
    for (const r of (data ?? []) as { category: string | null }[]) {
      if (r.category) set.add(r.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * A single event with its organiser + ticket types + updates.
 *
 * Loads any publicly-visible status (published / cancelled / postponed) so the
 * page can show a status banner instead of 404-ing. Draft and archived events
 * are not public (and are excluded by RLS anyway), so they resolve to null.
 */
export async function getEvent(id: string): Promise<EventDetail | null> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("events")
      .select(
        `id, title, category, status, venue, locality, lat, lng, starts_at, ends_at, cover_url, price_text, has_tickets,
         is_featured, description, doors_open_at, formatted_address, accessibility_info, age_restriction,
         contact_info, event_notes, refund_policy, ticket_url, gallery_urls,
         business:local_businesses(id,name,logo_url),
         hub:hubs(id,name,logo_url,brand_color),
         ticket_types:event_ticket_types(id,name,price_pence,description,quantity_available,quantity_sold,is_active,sale_starts_at,sale_ends_at,display_order)`,
      )
      .eq("id", id)
      .in("status", ["published", "cancelled", "postponed"])
      .maybeSingle();
    if (!data) return null;
    const ev = data as Record<string, unknown>;
    const tt = (ev.ticket_types as (TicketType & { display_order?: number })[]) ?? [];
    tt.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    // Event updates feed (public-read RLS for non-hidden events). Best-effort:
    // if the table is unreachable, fall back to an empty feed.
    let updates: EventUpdate[] = [];
    try {
      const { data: up } = await sb
        .from("event_updates")
        .select("id,title,body,kind,is_urgent,created_at")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      updates = (up ?? []) as unknown as EventUpdate[];
    } catch {
      updates = [];
    }

    return { ...(ev as unknown as EventDetail), ticket_types: tt, updates };
  } catch {
    return null;
  }
}

/* ── Date helpers + grouping ──────────────────────────────────────────────── */
export function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric" });
}
export function fmtMonthShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
}
export function fmtWeekday(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short" });
}
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}
export function fmtFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
export function fmtLongDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type DateGroup = { key: string; label: string; events: EventListItem[] };

/** Group a sorted event list by calendar date. */
export function groupByDate(events: EventListItem[]): DateGroup[] {
  const groups: DateGroup[] = [];
  const byKey = new Map<string, DateGroup>();
  for (const e of events) {
    const d = new Date(e.starts_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let g = byKey.get(key);
    if (!g) {
      g = { key, label: fmtFullDate(e.starts_at), events: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.events.push(e);
  }
  return groups;
}
