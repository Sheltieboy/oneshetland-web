import { publicClient } from "./supabase/public";

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
  "Festival",
  "Other",
] as const;

export type Organiser = { id: string; name: string; logo_url: string | null; brand_color?: string | null } | null;

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
};

export type TicketType = {
  id: string;
  name: string;
  price_pence: number;
  description: string | null;
};

export type EventDetail = EventListItem & {
  description: string | null;
  doors_open_at: string | null;
  formatted_address: string | null;
  accessibility_info: string | null;
  age_restriction: string | null;
  contact_info: string | null;
  ticket_url: string | null;
  gallery_urls: string[] | null;
  ticket_types: TicketType[];
};

const LIST_COLS =
  "id, title, category, venue, locality, starts_at, ends_at, cover_url, price_text, has_tickets, is_featured, organiser_hub_id, business:local_businesses(id,name,logo_url), hub:hubs(id,name,logo_url,brand_color)";

/** Upcoming published events (islands-wide), optionally filtered by category. */
export async function getUpcomingEvents(opts: { category?: string } = {}): Promise<EventListItem[]> {
  const sb = publicClient();
  const now = new Date().toISOString();
  let q = sb
    .from("events")
    .select(LIST_COLS)
    .eq("status", "published")
    .or("organiser_hub_id.is.null,calendar_approved.eq.true")
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(80);
  if (opts.category) q = q.eq("category", opts.category);
  try {
    const { data } = await q;
    return (data ?? []) as unknown as EventListItem[];
  } catch {
    return [];
  }
}

/** A single published event with its organiser + ticket types. */
export async function getEvent(id: string): Promise<EventDetail | null> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("events")
      .select(
        `id, title, category, venue, locality, starts_at, ends_at, cover_url, price_text, has_tickets,
         is_featured, description, doors_open_at, formatted_address, accessibility_info, age_restriction,
         contact_info, ticket_url, gallery_urls,
         business:local_businesses(id,name,logo_url),
         hub:hubs(id,name,logo_url,brand_color),
         ticket_types:event_ticket_types(id,name,price_pence,description,display_order)`,
      )
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (!data) return null;
    const ev = data as Record<string, unknown>;
    const tt = (ev.ticket_types as (TicketType & { display_order?: number })[]) ?? [];
    tt.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    return { ...(ev as unknown as EventDetail), ticket_types: tt };
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
