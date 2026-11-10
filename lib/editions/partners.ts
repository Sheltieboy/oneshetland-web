/**
 * Partnerships (R2): pure types, labels and validators. No I/O, so it is unit-tested directly.
 *
 * Vocabulary shown to people (plain, never "link", "entity" or "consent"):
 *   organiser invites -> "Invitation"    business/owner asks -> "Request to join"
 *   approved -> "Taking part"            declined / cancelled -> "Not taking part"    withdrawn -> "Stepped back"
 */
import { isUuid } from "./validate";
import type { Checked } from "./validate";

export type PartnerKind = "business" | "hub" | "event" | "activity";
export type LinkState = "pending" | "approved" | "declined" | "cancelled" | "withdrawn";
export type Initiator = "organiser" | "entity";

export const PARTNER_KIND_LABEL: Record<PartnerKind, string> = { business: "Business", hub: "Hub", event: "Event", activity: "Regular activity" };
export const PARTNER_KIND_NOUN: Record<PartnerKind, string> = { business: "your business", hub: "your Hub", event: "your event", activity: "your activity" };

/** The Partners screen filter: one list for businesses and Hubs together (and the events and activities organisers link individually). */
export type PartnerFilter = "all" | "business" | "hub" | "programme";
export const PARTNER_FILTERS: { key: PartnerFilter; label: string }[] = [
  { key: "all", label: "Everyone" }, { key: "business", label: "Businesses" }, { key: "hub", label: "Hubs" }, { key: "programme", label: "Events & activities" },
];
export const matchesFilter = (kind: PartnerKind, f: PartnerFilter) => f === "all" || (f === "programme" ? kind === "event" || kind === "activity" : kind === f);
/** Rows narrowed by the filter and a free-text search over the name and the heading (case-insensitive). */
export function filterPartnerRows<T extends { kind: PartnerKind; subject_name: string; label: string | null }>(rows: T[], filter: PartnerFilter, query: string): T[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => matchesFilter(r.kind, filter) && (!q || r.subject_name.toLowerCase().includes(q) || (r.label ?? "").toLowerCase().includes(q)));
}
export const countByFilter = (rows: { kind: PartnerKind }[]): Record<PartnerFilter, number> => ({
  all: rows.length, business: rows.filter((r) => r.kind === "business").length, hub: rows.filter((r) => r.kind === "hub").length,
  programme: rows.filter((r) => r.kind === "event" || r.kind === "activity").length,
});

/** A row as the organiser team sees it (RPC edition_partner_rows). */
export type PartnerRow = {
  link_id: string; kind: PartnerKind; subject_id: string; subject_name: string; subject_slug: string | null; subject_logo: string | null; owner_claimed: boolean;
  state: LinkState; initiated_by: Initiator; ended_by: Initiator | null; label: string | null; sort_order: number; message: string | null; response_note: string | null;
  created_at: string; decided_at: string | null; offers_selected: number; in_window: boolean;
};

/** A row as the owner of a business/event/activity sees it (RPC edition_my_partnerships). */
export type MyPartnership = {
  link_id: string; kind: PartnerKind; subject_id: string; subject_name: string; subject_business_id: string | null; state: LinkState; initiated_by: Initiator;
  ended_by: Initiator | null; label: string | null; message: string | null; response_note: string | null; created_at: string; decided_at: string | null;
  edition_id: string; edition_title: string; edition_slug: string; edition_summary: string | null; edition_starts_on: string; edition_ends_on: string;
  edition_cover_url: string | null; edition_status: string; edition_is_public: boolean; organiser_name: string; organiser_slug: string | null; offers_selected: number;
};

export type OfferOption = {
  offer_id: string; title: string; description: string | null; discount_type: string; discount_value: number | null; valid_until: string | null;
  selected: boolean; eligible: boolean; reason: string | null;
};

export type FindHub = { id: string; name: string; type: string | null; area: string | null; logo_url: string | null; slug: string | null; is_verified: boolean; link_state: LinkState | null };
/** One of a Hub's own events or activities it may choose to show under its card (RPC edition_hub_item_options). */
export type HubItemOption = { kind: "event" | "activity"; id: string; title: string; starts_at: string | null; venue: string | null; selected: boolean };
export const MAX_HUB_ITEMS = 12;
/** Hub types as people say them. */
export const HUB_TYPE_LABEL: Record<string, string> = { club: "Club", sports: "Sports", youth: "Youth", hall: "Hall", charity: "Charity", society: "Society", volunteer: "Volunteer group", arts: "Arts", community: "Community", other: "Hub" };
export const hubTypeLabel = (t: string | null | undefined) => (t ? HUB_TYPE_LABEL[t] ?? "Hub" : "Hub");

export type FindBusiness = { id: string; name: string; category: string | null; address: string | null; logo_url: string | null; slug: string | null; claimed: boolean; link_state: LinkState | null };
export type FindActivity = { kind: "event" | "activity"; id: string; title: string; starts_at: string | null; venue: string | null; owner_name: string | null; link_state: LinkState | null };
export type JoinableEdition = { edition_id: string; title: string; slug: string; summary: string | null; starts_on: string; ends_on: string; organiser_name: string };

export const CATEGORY_LABEL: Record<string, string> = {
  food_drink: "Food & drink", retail: "Shopping", services: "Services", tourism: "Tourism", accommodation: "Accommodation", other: "Other",
  health_wellbeing: "Health & wellbeing", arts_creative: "Arts & creative", sport_fitness: "Sport & fitness", community_voluntary: "Community & voluntary",
};
export const categoryLabel = (c: string | null | undefined) => (c ? CATEGORY_LABEL[c] ?? c.replace(/_/g, " ") : "");

/** What an organiser sees for each state, in words a committee volunteer understands. */
export function organiserStateText(r: Pick<PartnerRow, "state" | "initiated_by" | "ended_by">): { label: string; tone: "good" | "wait" | "ask" | "off"; hint: string } {
  if (r.state === "approved") return { label: "Taking part", tone: "good", hint: "Shown on your Edition." };
  if (r.state === "pending" && r.initiated_by === "organiser") return { label: "Invitation sent", tone: "wait", hint: "Waiting for them to answer. Nothing is shown publicly until they say yes." };
  if (r.state === "pending") return { label: "Asked to join", tone: "ask", hint: "They would like to take part. Say yes or no." };
  if (r.state === "declined") return { label: r.ended_by === "entity" ? "Said no" : "You said no", tone: "off", hint: r.ended_by === "entity" ? "They declined this time." : "You declined their request." };
  if (r.state === "cancelled") return { label: "Cancelled", tone: "off", hint: "This was cancelled before it was answered." };
  return { label: r.ended_by === "entity" ? "Stepped back" : "Removed", tone: "off", hint: r.ended_by === "entity" ? "They have taken themselves out of your Edition." : "You removed them from your Edition." };
}

/** What an owner sees for each state. */
export function ownerStateText(r: Pick<MyPartnership, "state" | "initiated_by" | "ended_by">): { label: string; tone: "good" | "wait" | "ask" | "off" } {
  if (r.state === "approved") return { label: "Taking part", tone: "good" };
  if (r.state === "pending" && r.initiated_by === "organiser") return { label: "Invitation", tone: "ask" };
  if (r.state === "pending") return { label: "Waiting for the organiser", tone: "wait" };
  if (r.state === "declined") return { label: r.ended_by === "entity" ? "You said no" : "Not accepted", tone: "off" };
  if (r.state === "cancelled") return { label: "Cancelled", tone: "off" };
  return { label: r.ended_by === "entity" ? "You stepped back" : "Removed by the organiser", tone: "off" };
}

export type PartnerAction = "approve" | "decline" | "cancel" | "withdraw" | "remove";
export const isPartnerAction = (a: unknown): a is PartnerAction => a === "approve" || a === "decline" || a === "cancel" || a === "withdraw" || a === "remove";
export const isPartnerKind = (k: unknown): k is PartnerKind => k === "business" || k === "hub" || k === "event" || k === "activity";

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type InviteInput = { kind: PartnerKind; subject: string; label: string | null; message: string | null };
export function inviteFields(i: Record<string, unknown>): Checked<InviteInput> {
  if (!isPartnerKind(i.kind)) return { ok: false, error: "Choose what you are inviting." };
  const subject = clean(i.subject), label = clean(i.label), message = clean(i.message);
  if (!isUuid(subject)) return { ok: false, error: "Choose a listing to invite." };
  if (label.length > 60) return { ok: false, error: "The heading must be 60 characters or fewer." };
  if (message.length > 500) return { ok: false, error: "The message must be 500 characters or fewer." };
  return { ok: true, value: { kind: i.kind, subject, label: label || null, message: message || null } };
}

export function noteField(raw: unknown): Checked<string | null> {
  const n = clean(raw);
  if (n.length > 300) return { ok: false, error: "The note must be 300 characters or fewer." };
  return { ok: true, value: n || null };
}

/** A starter message an organiser can edit; kept friendly and specific so the owner knows exactly what is being asked. */
export function suggestedInvite(args: { organiser: string; edition: string; dateLabel: string; kind: PartnerKind; subject: string }): string {
  const ask = args.kind === "business" ? `We would love ${args.subject} to take part in ${args.edition} (${args.dateLabel}).`
    : args.kind === "hub" ? `We would love ${args.subject} to be part of ${args.edition} (${args.dateLabel}), with a place on the Edition for the Hub and whichever of its events and activities you would like to show.`
    : args.kind === "event" ? `We would love to include ${args.subject} in ${args.edition} (${args.dateLabel}).`
    : `We would love to feature ${args.subject} in ${args.edition} (${args.dateLabel}).`;
  return `${ask} You stay in full control: you can say no, stop taking part at any time, and choose exactly what is shown.\n\nThank you,\n${args.organiser}`;
}

/** Group the offers/events/activities for display. */
export const byPosition = <T extends { position: number }>(a: T[]) => [...a].sort((x, y) => x.position - y.position);

/** Short badge text for an offer ("10% off", "£5 off", "Free gift"). The offer's own title always carries the detail. */
export function offerBadge(o: { discount_type: string; discount_value: number | null }): string {
  const v = o.discount_value == null ? null : Number(o.discount_value);
  switch (o.discount_type) {
    case "percent": return v ? `${v % 1 === 0 ? v : v.toFixed(1)}% off` : "Discount";
    case "fixed": return v ? `£${v % 1 === 0 ? v : v.toFixed(2)} off` : "Money off";
    case "freebie": return "Free extra";
    case "bogo": return "Two for one";
    default: return "Offer";
  }
}

/** Public link to a partner's own page on OneShetland (the Edition never copies or hosts a listing). */
export const businessHref = (id: string) => `/directory/${id}`;
export const eventHref = (id: string) => `/whats-on/${id}`;
export const activityHref = (slug: string) => `/whats-on/regular/${slug}`;
export const hubHref = (hub: { slug?: string | null; id: string }) => `/hubs/${hub.slug || hub.id}`;

/** One of a Hub's own events or activities, as offered by "Add from your Hub". `link_id` is set when it is already on the Edition. */
export type HubOwnItem = { kind: "event" | "activity"; id: string; title: string; starts_at: string | null; venue: string | null; link_id: string | null };
export const isHubOwnItem = (x: unknown): x is HubOwnItem => !!x && typeof x === "object" && ((x as HubOwnItem).kind === "event" || (x as HubOwnItem).kind === "activity") && typeof (x as HubOwnItem).id === "string" && typeof (x as HubOwnItem).title === "string";
/** Events first (by time as the database returns them), then regular activities. Pure, so it can be tested. */
export function splitHubOwnItems(items: HubOwnItem[]): { events: HubOwnItem[]; activities: HubOwnItem[]; added: number } {
  return { events: items.filter((i) => i.kind === "event"), activities: items.filter((i) => i.kind === "activity"), added: items.filter((i) => i.link_id).length };
}
