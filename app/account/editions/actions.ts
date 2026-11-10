"use server";

/**
 * Owner-side partnership actions: answer an invitation, choose offers, step back, propose your own events/activities, ask to join an Edition.
 * Runs as the signed-in user. The database decides who the owner is (the same rule the business, event and activity policies use), so passing
 * another person's link id does nothing. No service key.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/editions/rules";
import { MAX_HUB_ITEMS, isPartnerAction, isPartnerKind, noteField, type HubItemOption, type OfferOption } from "@/lib/editions/partners";
import { isUuid } from "@/lib/editions/validate";

type Fail = { ok: false; error: string };
type Result<T = object> = ({ ok: true } & T) | Fail;
const bad = (error: string): Fail => ({ ok: false, error });
const SIGN_IN = "Please sign in again to continue.";

async function authed() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user ? { sb, user } : null;
}
function refresh() {
  revalidatePath("/account/editions");
  revalidatePath("/business", "layout");
  revalidatePath("/editions", "layout");
}

export async function respondToPartnership(linkId: string, action: string, note?: string): Promise<Result<{ state: string }>> {
  const a = await authed();
  if (!a) return bad(SIGN_IN);
  if (!isUuid(linkId) || !isPartnerAction(action)) return bad("That invitation could not be found.");
  if (action === "remove") return bad("Only the organiser can remove a partner.");
  const n = noteField(note ?? "");
  if (!n.ok) return bad(n.error);
  const { data, error } = await a.sb.rpc("edition_link_act", { p_link: linkId, p_action: action, p_note: n.value });
  if (error) return bad(friendlyError(error.message));
  refresh();
  return { ok: true, state: String(data) };
}

export async function getOfferOptions(linkId: string): Promise<Result<{ options: OfferOption[] }>> {
  const a = await authed();
  if (!a) return bad(SIGN_IN);
  if (!isUuid(linkId)) return bad("That invitation could not be found.");
  const { data, error } = await a.sb.rpc("edition_offer_options", { p_link: linkId });
  if (error) return bad(friendlyError(error.message));
  return { ok: true, options: (data ?? []) as OfferOption[] };
}

export async function saveOffers(linkId: string, offerIds: string[]): Promise<Result<{ count: number }>> {
  const a = await authed();
  if (!a) return bad(SIGN_IN);
  if (!isUuid(linkId) || !Array.isArray(offerIds) || !offerIds.every(isUuid) || offerIds.length > 6) return bad("Choose up to 6 offers.");
  const { data, error } = await a.sb.rpc("edition_set_link_offers", { p_link: linkId, p_offer_ids: offerIds });
  if (error) return bad(friendlyError(error.message));
  refresh();
  return { ok: true, count: Number(data) };
}

/** The signed-in Hub administrator's own events and activities they may show under their Hub card in an Edition (the database refuses anyone else). */
export async function getHubItemOptions(linkId: string): Promise<Result<{ options: HubItemOption[] }>> {
  const a = await authed();
  if (!a) return bad(SIGN_IN);
  if (!isUuid(linkId)) return bad("That invitation could not be found.");
  const { data, error } = await a.sb.rpc("edition_hub_item_options", { p_link: linkId });
  if (error) return bad(friendlyError(error.message));
  return { ok: true, options: (data ?? []) as HubItemOption[] };
}

export async function saveHubItems(linkId: string, eventIds: string[], activityIds: string[]): Promise<Result<{ count: number }>> {
  const a = await authed();
  if (!a) return bad(SIGN_IN);
  if (!isUuid(linkId) || !Array.isArray(eventIds) || !Array.isArray(activityIds) || ![...eventIds, ...activityIds].every(isUuid) || eventIds.length + activityIds.length > MAX_HUB_ITEMS) return bad(`Choose up to ${MAX_HUB_ITEMS} items.`);
  const { data, error } = await a.sb.rpc("edition_set_hub_items", { p_link: linkId, p_events: eventIds, p_activities: activityIds });
  if (error) return bad(friendlyError(error.message));
  refresh();
  return { ok: true, count: Number(data) };
}

export type OwnItem = { kind: "event" | "activity"; id: string; title: string; starts_at: string | null };

/** The business's own upcoming events and published regular activities (read as the owner, so RLS applies), for "add one of mine". */
export async function getOwnItems(businessId: string): Promise<Result<{ items: OwnItem[] }>> {
  const a = await authed();
  if (!a) return bad(SIGN_IN);
  if (!isUuid(businessId)) return bad("That business could not be found.");
  const { data: biz } = await a.sb.from("local_businesses").select("id").eq("id", businessId).eq("owner_id", a.user.id).maybeSingle();
  if (!biz) return bad("You do not have permission to do that.");
  const [ev, ac] = await Promise.all([
    a.sb.from("events").select("id, title, starts_at").eq("organiser_business_id", businessId).eq("status", "published").gte("starts_at", new Date().toISOString()).order("starts_at").limit(30),
    a.sb.from("regular_activities").select("id, title").eq("organiser_business_id", businessId).eq("status", "published").order("title").limit(30),
  ]);
  const items: OwnItem[] = [
    ...((ev.data ?? []) as { id: string; title: string; starts_at: string }[]).map((e) => ({ kind: "event" as const, id: e.id, title: e.title, starts_at: e.starts_at })),
    ...((ac.data ?? []) as { id: string; title: string }[]).map((x) => ({ kind: "activity" as const, id: x.id, title: x.title, starts_at: null })),
  ];
  return { ok: true, items };
}

export async function requestToJoin(editionId: string, kind: string, subject: string, message?: string): Promise<Result<{ id: string }>> {
  const a = await authed();
  if (!a) return bad(SIGN_IN);
  if (!isUuid(editionId) || !isPartnerKind(kind) || !isUuid(subject)) return bad("That request could not be sent.");
  const m = typeof message === "string" ? message.trim() : "";
  if (m.length > 500) return bad("The message must be 500 characters or fewer.");
  const { data, error } = await a.sb.rpc("edition_request_to_join", { p_edition: editionId, p_kind: kind, p_subject: subject, p_message: m || null });
  if (error) return bad(friendlyError(error.message));
  refresh();
  return { ok: true, id: String(data) };
}

/** Public Editions this person could ask to join (small, soonest first). */
export async function getJoinable() {
  const a = await authed();
  if (!a) return [];
  const { data } = await a.sb.rpc("edition_joinable");
  return (data ?? []) as import("@/lib/editions/partners").JoinableEdition[];
}
