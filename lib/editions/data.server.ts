import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";
import { isLocalPath } from "@/lib/redirect";
import {
  EDITION_COLUMNS, ORGANISER_COLUMNS, ORGANISER_PUBLIC_COLUMNS, UPDATE_MANAGE_COLUMNS, UPDATE_PUBLIC_COLUMNS, VENUE_PUBLIC_COLUMNS,
  type Edition, type EditionEntitlement, type EditionPage, type EditionSession, type EditionSponsor, type EditionUpdate, type EditionVenue, type Organiser, type OrgRole,
} from "./types";
import { readiness, type Readiness } from "./rules";
import type { MyPartnership, PartnerRow } from "./partners";

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
  const [{ data: staff }, { count }] = await Promise.all([
    sb.rpc("edition_staff"),
    sb.from("edition_organiser_members").select("organiser_id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const isStaff = staff === true, isMember = (count ?? 0) > 0;
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
export type PublicPartners = { businesses: PublicPartnerBusiness[]; events: PublicPartnerEvent[]; activities: PublicPartnerActivity[] };

export type PublicEditionBundle = {
  edition: Edition; organiser: Organiser; pages: EditionPage[]; sessions: EditionSession[]; venues: EditionVenue[]; updates: EditionUpdate[]; sponsors: EditionSponsor[];
  seriesName: string | null; partners: PublicPartners;
  /** session id -> partner link ids the organiser named on it. A business shows only if its link is ALSO in partners.businesses (i.e. still public). */
  sessionBusinesses: Record<string, string[]>;
};

/**
 * The partners shown on an Edition. Reads the security-invoker views, so the visitor's own row-level security still decides everything: a
 * business that stops being public, an offer that expires or loses its plan, or a link the owner withdrew simply is not returned.
 */
export async function getPublicPartners(editionId: string): Promise<PublicPartners> {
  const sb = await createClient();
  const [biz, offers, events, acts] = await Promise.all([
    sb.from("edition_public_businesses").select("*").eq("edition_id", editionId).order("position").order("name"),
    sb.from("edition_public_offers").select("*").eq("edition_id", editionId),
    sb.from("edition_public_events").select("*").eq("edition_id", editionId).order("starts_at"),
    sb.from("edition_public_activities").select("*").eq("edition_id", editionId).order("position").order("title"),
  ]);
  const offerRows = arr<PublicPartnerOffer>(offers.data);
  const businesses = arr<Omit<PublicPartnerBusiness, "offers">>(biz.data).map((b) => ({ ...b, offers: offerRows.filter((o) => o.business_id === b.business_id) }));
  return { businesses, events: arr<PublicPartnerEvent>(events.data), activities: arr<PublicPartnerActivity>(acts.data) };
}

/** Rows for the organiser's Partners screen (database enforces editor+). */
export async function getPartnerRows(editionId: string): Promise<PartnerRow[]> {
  const sb = await createClient();
  const { data } = await sb.rpc("edition_partner_rows", { p_edition: editionId });
  return arr<PartnerRow>(data);
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
    edition, organiser: org.data as Organiser, pages: arr<EditionPage>(pages.data), sessions: sess, venues, sessionBusinesses,
    updates: arr<EditionUpdate>(updates.data).filter((u) => u.published_at && u.published_at <= nowIso),
    sponsors: arr<EditionSponsor>(sponsors.data), seriesName: (series.data as { name?: string } | null)?.name ?? null, partners,
  };
});

/** Free text for the index search: letters, numbers, spaces and a few safe marks only, so it cannot break out of the filter expression. */
export const searchTerm = (raw: unknown): string => (typeof raw === "string" ? raw.normalize("NFKC").replace(/[^\p{L}\p{N} '&-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "");

export type ListedOrganiser = { name: string; slug: string; logo_url: string | null; brand_color: string | null; cover_url: string | null; cover_focus: string | null };

/** The Editions index: published, public Editions (RLS), soonest first, optionally filtered. */
export async function listPublicEditions(opts: { kind?: string; when?: "upcoming" | "past" | "all"; limit?: number; q?: string } = {}) {
  const sb = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  let q = sb.from("editions").select(`${EDITION_COLUMNS}, organiser:edition_organisers ( name, slug, logo_url, brand_color, cover_url, cover_focus )`).eq("status", "published");
  if (opts.kind) q = q.eq("kind", opts.kind);
  const term = searchTerm(opts.q);
  if (term) q = q.or(`title.ilike.%${term}%,summary.ilike.%${term}%`);
  if (opts.when === "past") q = q.lt("ends_on", today).order("starts_on", { ascending: false });
  else if (opts.when !== "all") q = q.gte("ends_on", today).order("starts_on", { ascending: true });
  else q = q.order("starts_on", { ascending: true });
  const { data } = await q.limit(opts.limit ?? 60);
  return arr<Edition & { organiser: ListedOrganiser | null }>(data);
}

export async function getPublicOrganiser(slug: string) {
  const sb = await createClient();
  const { data } = await sb.from("edition_organisers").select(ORGANISER_PUBLIC_COLUMNS).eq("slug", slug).maybeSingle();
  if (!data) return null;
  const org = data as Organiser;
  const { data: eds } = await sb.from("editions").select(EDITION_COLUMNS).eq("organiser_id", org.id).eq("status", "published").order("starts_on", { ascending: false });
  return { organiser: org, editions: arr<Edition>(eds) };
}

/** Organisers the signed-in user belongs to (with their role). */
export async function getMyOrganisers(): Promise<{ organiser: Organiser; role: OrgRole }[]> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const { data } = await sb.from("edition_organiser_members").select(`role, organiser:edition_organisers ( ${ORGANISER_COLUMNS} )`).eq("user_id", user.id);
  return arr<{ role: OrgRole; organiser: Organiser | null }>(data).filter((r) => r.organiser).map((r) => ({ organiser: r.organiser as Organiser, role: r.role }));
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
  return { account, organiser, role: role as OrgRole, sb };
}

export type ManageBundle = {
  edition: Edition; pages: EditionPage[]; sessions: EditionSession[]; venues: EditionVenue[]; updates: EditionUpdate[]; sponsors: EditionSponsor[];
  entitlements: EditionEntitlement[]; entitled: boolean; checklist: Readiness; seriesOptions: { id: string; name: string }[];
};

export async function getManageBundle(organiser: Organiser, editionSlug: string): Promise<ManageBundle | null> {
  const sb = await createClient();
  const { data: ed } = await sb.from("editions").select(EDITION_COLUMNS).eq("organiser_id", organiser.id).eq("slug", editionSlug).maybeSingle();
  if (!ed) return null;
  const edition = ed as Edition;
  const [pages, sessions, venues, updates, sponsors, ents, ent, series] = await Promise.all([
    sb.from("edition_pages").select("*").eq("edition_id", edition.id).order("position"),
    sb.from("edition_sessions").select("*").eq("edition_id", edition.id).order("starts_at"),
    sb.from("edition_venues").select("*").eq("organiser_id", organiser.id).order("name"),
    sb.from("edition_updates").select(UPDATE_MANAGE_COLUMNS).eq("edition_id", edition.id).order("created_at", { ascending: false }),
    sb.from("edition_sponsors").select("*").eq("edition_id", edition.id).order("position"),
    sb.from("edition_entitlements").select("*").eq("edition_id", edition.id).order("created_at", { ascending: false }),
    sb.rpc("edition_entitled", { p_edition: edition.id, p_feature: "publish" }),
    sb.from("edition_series").select("id, name").eq("organiser_id", organiser.id).order("name"),
  ]);
  const p = arr<EditionPage>(pages.data), s = arr<EditionSession>(sessions.data);
  const entitled = ent.data === true;
  return {
    edition, pages: p, sessions: s, venues: arr<EditionVenue>(venues.data), updates: arr<EditionUpdate>(updates.data), sponsors: arr<EditionSponsor>(sponsors.data),
    entitlements: arr<EditionEntitlement>(ents.data), entitled, seriesOptions: arr<{ id: string; name: string }>(series.data),
    checklist: readiness({ edition, pages: p.length, sessions: s.length, verified: organiser.status === "verified", entitled }),
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
