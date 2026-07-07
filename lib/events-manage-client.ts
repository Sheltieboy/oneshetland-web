"use client";

/**
 * events-manage-client.ts — browser mutations for the business event organiser
 * area. Mirrors the app's events-api (createEvent / updateEvent / ticket-type
 * upsert / postEventUpdate / uploadEventImage).
 */

import { createClient } from "@/lib/supabase/client";
import type { EventStatus, EventUpdateKind } from "./events-data";

export type TicketMode = "none" | "oneshetland" | "external";

/** A ticket type as edited in the form. `id` present = existing row. */
export type EditableTicketType = {
  id?: string;
  name: string;
  price_pence: number;
  quantity_available: number | null;
};

export type BusinessEventInput = {
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
  cover_url: string | null;
  age_restriction: string | null;
  refund_policy: string | null;
  contact_info: string | null;
  event_notes: string | null;
  ticket_mode: TicketMode;
  ticket_url: string | null;
  ticket_types: EditableTicketType[];
};

/**
 * Upload a cover image to the public `event-media` bucket. The bucket's RLS
 * keys on the signed-in user (split_part(name,'/',1) = auth.uid()), matching
 * the app's uploadEventImage. Returns the public URL.
 */
export async function uploadEventCover(file: File): Promise<string> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Please sign in.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/events/cover-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("event-media").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = sb.storage.from("event-media").getPublicUrl(path);
  return data.publicUrl;
}

function buildEventRow(businessId: string, input: BusinessEventInput) {
  const hasTickets = input.ticket_mode !== "none";
  return {
    organiser_business_id: businessId,
    organiser_hub_id: null,
    title: input.title,
    description: input.description,
    category: input.category,
    status: input.status,
    venue: input.venue,
    locality: input.locality,
    lat: input.lat,
    lng: input.lng,
    place_id: input.place_id,
    formatted_address: input.formatted_address,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    doors_open_at: input.doors_open_at,
    cover_url: input.cover_url,
    has_tickets: hasTickets,
    ticket_url: input.ticket_mode === "external" ? input.ticket_url : null,
    age_restriction: input.age_restriction,
    refund_policy: input.refund_policy,
    contact_info: input.contact_info,
    event_notes: input.event_notes,
  };
}

/** Replace the event's ticket types (OneShetland mode only). */
async function syncTicketTypes(
  sb: ReturnType<typeof createClient>,
  eventId: string,
  mode: TicketMode,
  types: EditableTicketType[],
) {
  if (mode !== "oneshetland") {
    // Deactivate any existing OneShetland ticket types when switching away.
    await sb.from("event_ticket_types").update({ is_active: false }).eq("event_id", eventId);
    return;
  }
  // Soft-delete removed ones, upsert the rest. Simplest reliable approach:
  // deactivate all, then insert/update the supplied set.
  const keepIds = types.filter(t => t.id).map(t => t.id as string);
  let deactivate = sb.from("event_ticket_types").update({ is_active: false }).eq("event_id", eventId);
  if (keepIds.length) deactivate = deactivate.not("id", "in", `(${keepIds.join(",")})`);
  await deactivate;

  const valid = types.filter(t => t.name.trim());
  for (let i = 0; i < valid.length; i++) {
    const t = valid[i];
    const row = {
      event_id: eventId,
      name: t.name.trim(),
      price_pence: t.price_pence,
      quantity_available: t.quantity_available ?? null,
      display_order: i,
      is_active: true,
    };
    if (t.id) {
      await sb.from("event_ticket_types").update(row).eq("id", t.id);
    } else {
      await sb.from("event_ticket_types").insert(row);
    }
  }
}

/** Create a new business-organised event. Returns the new event id. */
export async function createBusinessEvent(businessId: string, input: BusinessEventInput): Promise<string> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Please sign in.");
  const { data: ev, error } = await sb
    .from("events")
    .insert({ organiser_user_id: user.id, ...buildEventRow(businessId, input) })
    .select("id")
    .single();
  if (error || !ev) throw error ?? new Error("Could not create event.");
  await syncTicketTypes(sb, ev.id, input.ticket_mode, input.ticket_types);
  return ev.id;
}

/** Edit an existing business-organised event. */
export async function updateBusinessEvent(
  businessId: string,
  eventId: string,
  input: BusinessEventInput,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("events")
    .update(buildEventRow(businessId, input))
    .eq("id", eventId);
  if (error) throw error;
  await syncTicketTypes(sb, eventId, input.ticket_mode, input.ticket_types);
}

/** Change just the event status (publish / unpublish / postpone / cancel / archive). */
export async function setEventStatus(eventId: string, status: EventStatus): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("events").update({ status }).eq("id", eventId);
  if (error) throw error;
}

/**
 * Post an organiser update. Inserts into event_updates and invokes the same
 * notify-event-update edge function the app uses to alert ticket-holders.
 */
export async function postEventUpdate(input: {
  eventId: string;
  title: string;
  body: string;
  kind: EventUpdateKind;
  is_urgent: boolean;
}): Promise<void> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Please sign in.");
  const { data, error } = await sb
    .from("event_updates")
    .insert({
      event_id: input.eventId,
      author_id: user.id,
      title: input.title,
      body: input.body,
      kind: input.kind,
      is_urgent: input.is_urgent,
    })
    .select("id")
    .single();
  if (error) throw error;
  // Tell every ticket-holder (fire-and-forget, same edge fn as the app).
  if (data?.id) {
    sb.functions.invoke("notify-event-update", { body: { update_id: data.id } }).catch(() => {});
  }
}
