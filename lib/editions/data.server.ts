import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";
import { isLocalPath } from "@/lib/redirect";
import {
  EDITION_COLUMNS, ORGANISER_COLUMNS, ORGANISER_PUBLIC_COLUMNS, UPDATE_MANAGE_COLUMNS, UPDATE_PUBLIC_COLUMNS, VENUE_PUBLIC_COLUMNS,
  type Edition, type EditionEntitlement, type EditionPage, type EditionSession, type EditionSponsor, type EditionUpdate, type EditionVenue, type Organiser, type OrgRole,
} from "./types";
import { parseReadiness, type Readiness } from "./rules";
import { parseReviewStatus, type ReviewStatus } from "./journey";
import { isHubOwnItem, type HubOwnItem, type MyPartnership, type PartnerRow } from "./partners";
import { BUSINESS_PUBLIC_COLUMNS, HUB_PUBLIC_COLUMNS, businessParent, hubParent, inheritFromParent, type HubIdentity, type ParentIdentity } from "./hub-brand";

/**
 * Server-side reads for Editions. Every read runs as the visitor (anon key + their session), so row-level security in the database decides what
 * they can see: a visitor gets published, entitled, verified, non-test Editions; an organiser member also gets their own drafts; staff get all.
 * Nothing here uses a service key.
 */

/** Is Editions switched on? Fails CLOSED: anything but an explicit true means off for the public (members and staff are checked by RLS, not this flag). */
export const getEditionsEnabled = cache(async (): Promise<boolean> => {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("editions_enabled");
    return !error && data === true;
  } catch { return false; }
});

/**
 * Who may use the organiser area while Editions ships dark: staff, and anyone who already belongs to an organiser. When the flag is on, any signed-in user may
 * start an organiser profile. The database is still the authority for every read and write; this only decides whether the pages exist for the visitor.
 */
export const getEditionsAccess = cache(async (): Promise<{ signedIn: boolean; enabled: boolean; staff: boolean; member: boolean; allowed: boolean }> => {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const enabled = await getEditionsEnabled();
  if (!user) return { signedIn: false, enabled, staff: false, member: false, allowed: false };
  const [{ data: staff }, access] = await Promise.all([
    sb.rpc("edition_staff"),
    sb.rpc("edition_has_organiser_access"),
  ]);
  // A member is anyone with an organiser team role OR Hub-derived authority (the database decides, live). An older database without the function falls back to team rows only.
  let isMember = access.data === true;
  if (access.error) { const { count } = await sb.from("edition_organiser_members").select("organiser_id", { count: "exact", head: true }).eq("user_id", user.id); isMember = (count ?? 0) > 0; }
  const isStaff = staff === true;
  return { signedIn: true, enabled, staff: isStaff, member: isMember, allowed: enabled || isStaff || isMember };
});

export type PublicPartnerBusiness = {
  link_id: string; business_id: string; name: string; slug: string | null; category: string | null; description: string | null; address: string | null;
  logo_url: string | null; cover_url: string | null; label: string | null; position: number; offers: PublicPartnerOffer[];
};
export type PublicPartnerOffer = { offer_id: string; business_id: string; title: string; description: string | null; discount_type: string; discount_value: number | null; valid_until: string | null; terms: string | null };
export type PublicPartnerEvent = {
  link_id: string; event_id: string; title: string; description: string | null; starts_at: string; ends_at: string | null; venue: string | null; locality: string | null;
  cover_url: string | null; price_text: string | null; ticket_url: string | null; has_tickets: boolean; status: string; category: string | null; label: string | null; position: number;
};
export type PublicPartnerActivity = {
  link_id: string; activity_id: string; slug: string; title: string; description: string | null; category: string | null; venue: string | null; locality: string | null;
  cover_url: string | null; price_text: string | null; label: string | null; position: number;
};
export type PublicHubItem = { kind: "event" | "activity"; title: string; href: string; when: string | null; venue: string | null };
export type PublicPartnerHub = {
  link_id: string; hub_id: string; name: string; slug: string | null; type: string | null; description: string | null; area: string | null; website: string | null;
  logo_url: string | null; cover_url: string | null; brand_color: string | null; is_verified: boolean; is_charity: boolean; label: string | null; position: number; items: PublicHubItem[];
};
export type PublicPartners = { businesses: PublicPartnerBusiness[]; events: PublicPartnerEvent[]; activities: PublicPartnerActivity[]; hubs: PublicPartnerHub[] };

export type PublicEditionBundle = {
  edition: Edition; organiser: Organiser; pages: EditionPage[]; sessions: EditionSession[]; venues: EditionVenue[]; updates: EditionUpdate[]; sponsors: EditionSponsor[];
  seriesName: string | null; partners: PublicPartners;
  /** The Hub that runs this Edition (its identity is inherited into `organiser` where the organiser set nothing of its own); null when a Business runs it. */
  hub: HubIdentity | null;
  /** The Hub or Business that runs this Edition (what "Run by ..." links to). */
  parent: ParentIdentity | null;
  /** session id -> partner link ids the organiser named on it. A business shows only if its link is ALSO in partners.businesses (i.e. still public). */
  sessionBusinesses: Record<string, string[]>;
};

/**
 * The partners shown on an Edition. Reads the security-invoker views, so the visitor's own row-level security still decides everything: a
 * business that stops being public, an offer that expires or loses its plan, or a link the owner withdrew simply is not returned.
 */
export async function getPublicPartners(editionId: string): Promise<PublicPartners> {
  const sb = await createClient();
  const [biz, offers, events, acts, hubRows, hubItems] = await Promise.all([
    sb.from("edition_public_businesses").select("*").eq("edition_id", editionId).order("position").order("name"),
    sb.from("edition_public_offers").select("*").eq("edition_id", editionId),
    sb.from("edition_public_events").select("*").eq("edition_id", editionId).order("starts_at"),
    sb.from("edition_public_activities").select("*").eq("edition_id", editionId).order("position").order("title"),
    // Hubs (Editions 1.1). Tolerant: a database without the views simply has none.
    sb.from("edition_public_hubs").select("link_id, hub_id, name, slug, type, description, area, website, logo_url, cover_url, brand_color, is_verified, is_charity, label, position").eq("edition_id", editionId).order("position").order("name"),
    sb.from("edition_public_hub_items").select("link_id, position, kind, event_id, event_title, starts_at, event_venue, activity_slug, activity_title, activity_venue").eq("edition_id", editionId).order("position"),
  ]);
  const itemsByLink = new Map<string, PublicHubItem[]>();
  for (const r of arr<{ link_id: string; kind: "event" | "activity"; event_id: string | null; event_title: string | null; starts_at: string | null; event_venue: string | null; activity_slug: string | null; activity_title: string | null; activity_venue: string | null }>(hubItems.data)) {
    const item: PublicHubItem | null = r.kind === "event" && r.event_id && r.event_title ? { kind: "event", title: r.event_title, href: `/whats-on/${r.event_id}`, when: r.starts_at, venue: r.event_venue }
      : r.kind === "activity" && r.activity_slug && r.activity_title ? { kind: "activity", title: r.activity_title, href: `/whats-on/regular/${r.activity_slug}`, when: null, venue: r.activity_venue } : null;
    if (item) (itemsByLink.get(r.link_id) ?? itemsByLink.set(r.link_id, []).get(r.link_id)!).push(item);
  }
  const hubs = arr<Omit<PublicPartnerHub, "items">>(hubRows.data).map((h) => ({ ...h, items: itemsByLink.get(h.link_id) ?? [] }));
  const offerRows = arr<PublicPartnerOffer>(offers.data);
  const businesses = arr<Omit<PublicPartnerBusiness, "offers">>(biz.data).map((b) => ({ ...b, offers: offerRows.filter((o) => o.business_id === b.business_id) }));
  return { businesses, events: arr<PublicPartnerEvent>(events.data), activities: arr<PublicPartnerActivity>(acts.data), hubs };
}

/** Rows for the organiser's Partners screen (database enforces editor+). */
export async function getPartnerRows(editionId: string): Promise<PartnerRow[]> {
  const sb = await createClient();
  const { data } = await sb.rpc("edition_partner_rows", { p_edition: editionId });
  return arr<PartnerRow>(data);
}

/** The Hub's own listings for "Add from your Hub". `forbidden` means the signed-in person is on the organiser team but is not the Hub's owner or committee. */
export async function getHubOwnItems(editionId: string): Promise<{ state: "ok"; items: HubOwnItem[] } | { state: "forbidden" } | { state: "unavailable" }> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("edition_hub_own_items", { p_edition: editionId });
  if (error) return /42501|not permitted/i.test(`${error.code ?? ""} ${error.message}`) ? { state: "forbidden" } : { state: "unavailable" };
  return { state: "ok", items: arr<unknown>(data).filter(isHubOwnItem) };
}

/** Everything the signed-in user controls that an organiser has invited, or that they have asked to join. */
export async function getMyPartnerships(): Promise<MyPartnership[]> {
  const sb = await createClient();
  const { data } = await sb.rpc("edition_my_partnerships");
  return arr<MyPartnership>(data);
}

export async function getMyPendingPartnerCount(): Promise<number> {
  try {
    const sb = await createClient();
    const { data } = await sb.rpc("edition_my_pending_count");
    return typeof data === "number" ? data : 0;
  } catch { return 0; }
}

const arr = <T,>(d: unknown): T[] => (Array.isArray(d) ? (d as T[]) : []);

/** One Edition for the public page (or a member/staff preview of a draft). null = not visible to this person. */
export const getEditionBundle = cache(async (slug: string): Promise<PublicEditionBundle | null> => {
  const sb = await createClient();
  const { data: ed } = await sb.from("editions").select(EDITION_COLUMNS).eq("slug", slug).maybeSingle();
  if (!ed) return null;
  const edition = ed as Edition;
  const nowIso = new Date().toISOString();
  const [org, pages, sessions, updates, sponsors, series, partners] = await Promise.all([
    sb.from("edition_organisers").select(ORGANISER_PUBLIC_COLUMNS).eq("id", edition.organiser_id).maybeSingle(),
    sb.from("edition_pages").select("*").eq("edition_id", edition.id).order("position"),
    sb.from("edition_sessions").select("*").eq("edition_id", edition.id).order("starts_at"),
    sb.from("edition_updates").select(UPDATE_PUBLIC_COLUMNS).eq("edition_id", edition.id).order("pinned", { ascending: false }).order("published_at", { ascending: false }),
    sb.from("edition_sponsors").select("*").eq("edition_id", edition.id).order("position"),
    edition.series_id ? sb.from("edition_series").select("name").eq("id", edition.series_id).maybeSingle() : Promise.resolve({ data: null }),
    getPublicPartners(edition.id),
  ]);
  if (!org.data) return null;
  const hub = await getHubIdentity((org.data as Organiser).hub_id);
  const parent = await getParentIdentity(org.data as Organiser);
  const sess = arr<EditionSession>(sessions.data);
  const venueIds = [...new Set(sess.map((s) => s.venue_id).filter((v): v is string => !!v))];
  const venues = venueIds.length ? arr<EditionVenue>((await sb.from("edition_venues").select(VENUE_PUBLIC_COLUMNS).in("id", venueIds)).data) : [];
  // which partner businesses are named on which session (tolerant: an older database without the table simply has none)
  const sessionBusinesses: Record<string, string[]> = {};
  if (sess.length) {
    const { data: sb2, error: sbErr } = await sb.from("edition_session_businesses").select("session_id, link_id, position").in("session_id", sess.map((x) => x.id)).order("position");
    if (!sbErr) for (const r of arr<{ session_id: string; link_id: string }>(sb2)) (sessionBusinesses[r.session_id] ??= []).push(r.link_id);
  }
  return {
    edition, organiser: inheritFromParent(org.data as Organiser, parent), hub, parent, pages: arr<EditionPage>(pages.data), sessions: sess, venues, sessionBusinesses,
    updates: arr<EditionUpdate>(updates.data).filter((u) => u.published_at && u.published_at <= nowIso),
    sponsors: arr<EditionSponsor>(sponsors.data), seriesName: (series.data as { name?: string } | null)?.name ?? null, partners,
  };
});

/** Free text for the index search: letters, numbers, spaces and a few safe marks only, so it cannot break out of the filter expression. */
export const searchTerm = (raw: unknown): string => (typeof raw === "string" ? raw.normalize("NFKC").replace(/[^\p{L}\p{N} '&-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "");

export type ListedOrganiser = { name: string; slug: string; logo_url: string | null; brand_color: string | null; cover_url: string | null; cover_focus: string | null; hub?: { logo_url: string | null; brand_color: string | null; cover_url: string | null } | null };

/** The Editions index: published, public Editions (RLS), soonest first, optionally filtered. */
export async function listPublicEditions(opts: { kind?: string; when?: "upcoming" | "past" | "all"; limit?: number; q?: string } = {}) {
  const sb = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  let q = sb.from("editions").select(`${EDITION_COLUMNS}, organiser:edition_organisers ( name, slug, logo_url, brand_color, cover_url, cover_focus, hub:hubs ( logo_url, brand_color, cover_url ) )`).eq("status", "published");
  if (opts.kind) q = q.eq("kind", opts.kind);
  const term = searchTerm(opts.q);
  if (term) q = q.or(`title.ilike.%${term}%,summary.ilike.%${term}%`);
  if (opts.when === "past") q = q.lt("ends_on", today).order("starts_on", { ascending: false });
  else if (opts.when !== "all") q = q.gte("ends_on", today).order("starts_on", { ascending: true });
  else q = q.order("starts_on", { ascending: true });
  const first = await q.limit(opts.limit ?? 60);
  let data = first.data;
  if (first.error) {
    // Tolerant: if the Hub embed is not available (an older database, a column grant), fall back to the plain organiser columns so the index never goes blank.
    let plain = sb.from("editions").select(`${EDITION_COLUMNS}, organiser:edition_organisers ( name, slug, logo_url, brand_color, cover_url, cover_focus )`).eq("status", "published");
    if (opts.kind) plain = plain.eq("kind", opts.kind);
    if (term) plain = plain.or(`title.ilike.%${term}%,summary.ilike.%${term}%`);
    if (opts.when === "past") plain = plain.lt("ends_on", today).order("starts_on", { ascending: false });
    else if (opts.when !== "all") plain = plain.gte("ends_on", today).order("starts_on", { ascending: true });
    else plain = plain.order("starts_on", { ascending: true });
    data = (await plain.limit(opts.limit ?? 60)).data as unknown as typeof data;
  }
  // A Hub-run organiser shows its Hub's logo, colour and cover wherever it set none of its own (read live, never copied).
  return arr<Edition & { organiser: ListedOrganiser | null }>(data).map((e) => {
    const o = e.organiser; const h = o?.hub;
    if (!o || !h) return e;
    return { ...e, organiser: { ...o, logo_url: o.logo_url || h.logo_url, brand_color: o.brand_color || h.brand_color, cover_url: o.cover_url || h.cover_url, cover_focus: o.cover_url ? o.cover_focus : null, hub: undefined } };
  });
}

export async function getPublicOrganiser(slug: string) {
  const sb = await createClient();
  const { data } = await sb.from("edition_organisers").select(ORGANISER_PUBLIC_COLUMNS).eq("slug", slug).maybeSingle();
  if (!data) return null;
  const raw = data as Organiser;
  const hub = await getHubIdentity(raw.hub_id);
  const parent = await getParentIdentity(raw);
  const org = inheritFromParent(raw, parent);
  const { data: eds } = await sb.from("editions").select(EDITION_COLUMNS).eq("organiser_id", org.id).eq("status", "published").order("starts_on", { ascending: false });
  return { organiser: org, editions: arr<Edition>(eds), hub, parent };
}

/**
 * Editions profiles the signed-in user can work on. `viaParent` is true when access comes with their Business or Hub (owner, or a Hub's committee), false when they were
 * invited as a helper. `parentKind` says which parent it is.
 */
export type MyOrganiser = { organiser: Organiser; role: OrgRole; viaParent: boolean; parentKind: "hub" | "business" | null };
export async function getMyOrganisers(): Promise<MyOrganiser[]> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const kindOf = (o: Organiser) => (o.hub_id ? "hub" : o.business_id ? "business" : null) as MyOrganiser["parentKind"];
  // Team memberships plus authority that comes with the Business or Hub, decided by the database at this moment (a demoted committee member simply stops appearing).
  const mine = await sb.rpc("edition_my_organisers");
  if (!mine.error) {
    const rows = arr<{ organiser_id: string; role: OrgRole; via_hub: boolean }>(mine.data);
    if (!rows.length) return [];
    const { data: orgs } = await sb.from("edition_organisers").select(ORGANISER_COLUMNS).in("id", rows.map((r) => r.organiser_id));
    const byId = new Map(arr<Organiser>(orgs).map((o) => [o.id, o]));
    return rows.filter((r) => byId.has(r.organiser_id)).map((r) => { const o = byId.get(r.organiser_id) as Organiser; return { organiser: o, role: r.role, viaParent: r.via_hub, parentKind: kindOf(o) }; });
  }
  const { data } = await sb.from("edition_organiser_members").select(`role, organiser:edition_organisers ( ${ORGANISER_COLUMNS} )`).eq("user_id", user.id);
  return arr<{ role: OrgRole; organiser: Organiser | null }>(data).filter((r) => r.organiser).map((r) => ({ organiser: r.organiser as Organiser, role: r.role, viaParent: false, parentKind: kindOf(r.organiser as Organiser) }));
}

/** A Hub's public identity (the database's public column whitelist only). null when the id is empty or the Hub is not public. */
export const getHubIdentity = cache(async (hubId: string | null | undefined): Promise<HubIdentity | null> => {
  if (!hubId) return null;
  try {
    const sb = await createClient();
    const { data } = await sb.from("hubs").select(HUB_PUBLIC_COLUMNS).eq("id", hubId).eq("is_active", true).maybeSingle();
    return (data as HubIdentity | null) ?? null;
  } catch { return null; }
});

/** A Business's public identity, from the public view (safe columns only). null when it is not listed. */
export const getBusinessIdentity = cache(async (businessId: string | null | undefined): Promise<ParentIdentity | null> => {
  if (!businessId) return null;
  try {
    const sb = await createClient();
    const { data } = await sb.from("local_businesses_public").select(BUSINESS_PUBLIC_COLUMNS).eq("id", businessId).eq("is_active", true).maybeSingle();
    return data ? businessParent(data as Parameters<typeof businessParent>[0]) : null;
  } catch { return null; }
});

/** The Hub or Business behind an Edition's organiser (live public identity), or null. Works for either kind. */
export async function getParentIdentity(o: Pick<Organiser, "hub_id" | "business_id">): Promise<ParentIdentity | null> {
  if (o.hub_id) { const h = await getHubIdentity(o.hub_id); return h ? hubParent(h) : null; }
  if (o.business_id) return getBusinessIdentity(o.business_id);
  return null;
}

/**
 * Should a Hub's management area show the Festivals & Editions entry? Yes for anyone who runs the Hub (owner or active committee): the database decides who that is. `pending` is the
 * number of invitations waiting for the Hub.
 */
export async function getHubEditionsEntry(hubId: string): Promise<{ show: boolean; pending: number; organiserSlug: string | null }> {
  const mine = await getMyHubEditions();
  const row = mine.find((h) => h.hub_id === hubId) ?? null;
  return { show: !!row, pending: row?.pending_invitations ?? 0, organiserSlug: row?.organiser_slug ?? null };
}

/** The Hubs the signed-in person runs (owner or active committee) and where each stands with Editions. */
export type MyHubEditions = { hub_id: string; hub_name: string; hub_slug: string | null; hub_role: "owner" | "committee"; organiser_id: string | null; organiser_slug: string | null; organiser_status: string | null; edition_count: number; pending_invitations: number; in_review: number };
export async function getMyHubEditions(): Promise<MyHubEditions[]> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("edition_my_hubs");
    if (error) return [];
    const rows = arr<Omit<MyHubEditions, "in_review">>(data);
    const ids = rows.map((r) => r.organiser_id).filter((x): x is string => !!x);
    // How many are waiting for OneShetland's review (a readable column; the team can see its own Editions).
    const reviewing = new Map<string, number>();
    if (ids.length) {
      const { data: eds } = await sb.from("editions").select("organiser_id").eq("review_state", "submitted").in("organiser_id", ids);
      for (const e of arr<{ organiser_id: string }>(eds)) reviewing.set(e.organiser_id, (reviewing.get(e.organiser_id) ?? 0) + 1);
    }
    return rows.map((r) => ({ ...r, in_review: r.organiser_id ? reviewing.get(r.organiser_id) ?? 0 : 0 }));
  } catch { return []; }
}

/** The Businesses the signed-in person owns and where each stands with Editions (the Business twin of getMyHubEditions). */
export type MyBusinessEditions = { business_id: string; business_name: string; organiser_id: string | null; organiser_slug: string | null; organiser_status: string | null; edition_count: number; in_review: number };
export async function getMyBusinessEditions(): Promise<MyBusinessEditions[]> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("edition_my_businesses");
    return error ? [] : arr<MyBusinessEditions>(data);
  } catch { return []; }
}

export async function getMyInvites() {
  const sb = await createClient();
  const { data } = await sb.rpc("edition_my_org_invites");
  // The database names the organiser for the person it invited (and only for them).
  return arr<{ invite_id: string; organiser_id: string; organiser_name: string; role: OrgRole; expires_at: string }>(data).map((i) => ({ id: i.invite_id, organiser_id: i.organiser_id, organiser_name: i.organiser_name, role: i.role, expires_at: i.expires_at }));
}

/** Gate for /organise/[slug]/...: signed in AND an active member. Not a member = 404 (never reveals that the organiser exists). */
export async function requireOrganiser(slug: string, opts: { returnPath: string; min?: OrgRole }) {
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=${encodeURIComponent(isLocalPath(opts.returnPath) ? opts.returnPath : "/organise")}`);
  const sb = await createClient();
  const { data } = await sb.from("edition_organisers").select(ORGANISER_COLUMNS).eq("slug", slug).maybeSingle();
  if (!data) notFound();
  const organiser = data as Organiser;
  const { data: role } = await sb.rpc("edition_org_role", { p_org: organiser.id });
  if (!role) notFound();
  // The private contact email is readable by the team only, through a function (signed-in strangers cannot select the column).
  const { data: contact } = await sb.rpc("edition_org_contact_email", { p_org: organiser.id });
  organiser.contact_email = typeof contact === "string" ? contact : null;
  // An organiser inherits its Hub's or Business's identity wherever it set nothing; the raw organiser stays as saved so the forms show only what is genuinely its own.
  const hub = await getHubIdentity(organiser.hub_id);
  const parent = hub ? hubParent(hub) : await getParentIdentity(organiser);
  // `hub` is set only for a Hub-run organiser (Hub-only features such as "Add from your Hub" key on it); `parent` is the Hub or Business, for identity and inheritance.
  return { account, organiser, hub, parent, role: role as OrgRole, sb };
}

export type ManageBundle = {
  edition: Edition; pages: EditionPage[]; sessions: EditionSession[]; venues: EditionVenue[]; updates: EditionUpdate[]; sponsors: EditionSponsor[];
  entitlements: EditionEntitlement[]; entitled: boolean; /** The database's checklist for this Edition. */ checklist: Readiness; review: ReviewStatus; seriesOptions: { id: string; name: string }[];
};

export async function getManageBundle(organiser: Organiser, editionSlug: string): Promise<ManageBundle | null> {
  const sb = await createClient();
  const { data: ed } = await sb.from("editions").select(EDITION_COLUMNS).eq("organiser_id", organiser.id).eq("slug", editionSlug).maybeSingle();
  if (!ed) return null;
  const edition = ed as Edition;
  const [pages, sessions, venues, updates, sponsors, ents, ent, series, ready, rev] = await Promise.all([
    sb.from("edition_pages").select("*").eq("edition_id", edition.id).order("position"),
    sb.from("edition_sessions").select("*").eq("edition_id", edition.id).order("starts_at"),
    sb.from("edition_venues").select("*").eq("organiser_id", organiser.id).order("name"),
    sb.from("edition_updates").select(UPDATE_MANAGE_COLUMNS).eq("edition_id", edition.id).order("created_at", { ascending: false }),
    sb.from("edition_sponsors").select("*").eq("edition_id", edition.id).order("position"),
    sb.from("edition_entitlements").select("*").eq("edition_id", edition.id).order("created_at", { ascending: false }),
    sb.rpc("edition_entitled", { p_edition: edition.id, p_feature: "publish" }),
    sb.from("edition_series").select("id, name").eq("organiser_id", organiser.id).order("name"),
    sb.rpc("edition_readiness", { p_edition: edition.id }),
    sb.rpc("edition_review_status", { p_edition: edition.id }),
  ]);
  const p = arr<EditionPage>(pages.data), s = arr<EditionSession>(sessions.data);
  const entitled = ent.data === true;
  return {
    edition, pages: p, sessions: s, venues: arr<EditionVenue>(venues.data), updates: arr<EditionUpdate>(updates.data), sponsors: arr<EditionSponsor>(sponsors.data),
    entitlements: arr<EditionEntitlement>(ents.data), entitled, seriesOptions: arr<{ id: string; name: string }>(series.data),
    checklist: parseReadiness(ready.data), review: parseReviewStatus(rev.data, edition.review_state),
  };
}

/* ── Visitor (R3): saves and plan ─────────────────────────────────────────────────────────────────────────────── */

export type EditionFlags = { saved: boolean; sessions: string[]; events: string[] };
/** The signed-in visitor's save and plan state for one Edition. null = signed out (buttons then lead to sign-in). */
export const getMyEditionFlags = cache(async (editionId: string): Promise<EditionFlags | null> => {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.rpc("edition_my_flags", { p_edition: editionId });
    const f = data as Partial<EditionFlags> | null;
    return f ? { saved: !!f.saved, sessions: f.sessions ?? [], events: f.events ?? [] } : { saved: false, sessions: [], events: [] };
  } catch { return null; }
});

export type PlanRow = {
  edition_id: string; edition_title: string; edition_slug: string; edition_starts_on: string; edition_ends_on: string; edition_saved: boolean;
  kind: "session" | "event" | null; item_id: string | null; title: string | null; starts_at: string | null; ends_at: string | null; venue: string | null;
  status: string | null; item_href: string | null; last_update_at: string | null;
};
export async function getMyPlan(): Promise<PlanRow[]> {
  const sb = await createClient();
  const { data } = await sb.rpc("edition_my_plan");
  return arr<PlanRow>(data);
}
