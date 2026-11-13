/**
 * house-swaps.ts — OneShetland House Swaps: types, vocabulary, labels, URL query parsing and advert validation.
 *
 * Pure (no network, no Next imports) so it runs under `node --test`. The database is the authority on every rule here; these helpers only make
 * the website friendly (clear labels, early warnings) and keep one copy of the wording.
 *
 * House Swaps is a moderated NOTICEBOARD for social-housing tenants. It never asks for or shows an address, a name, contact details or personal
 * circumstances: an advert is a broad area, a number of bedrooms, a property type and a few practical features.
 */

/** The one shared disclaimer. Shown wherever someone is about to act on an advert. */
export const HOUSE_SWAPS_DISCLAIMER =
  "OneShetland House Swaps only helps tenants find each other. We don't check eligibility, approve exchanges or act for any landlord. Any mutual exchange needs the written consent of both landlords and must follow Scottish housing rules, so speak to your landlord before you agree anything.";

/** The safety warning. Shown next to the disclaimer everywhere (board, advert, my advert, messages, enquiry, how it works). */
export const NEVER_PAY =
  "Never pay anyone to arrange or speed up a house swap. House Swaps is free, and a genuine swap never needs money to change hands. If someone asks you for money, don't send it, and report them.";

export const HOUSE_SWAPS_INTRO =
  "A free noticeboard where Shetland council and housing association tenants can find someone to swap homes with. Most people are looking for more room, or a move closer to Lerwick or further out; when someone's gain is someone else's wish, a swap becomes possible.";

export const INTRODUCTIONS_ONLY = "Introductions only: we help you find each other, nothing more.";

export const CONTACT_RULE =
  "Please keep phone numbers, email addresses and web links out of your advert. You can talk privately in the messages here once someone gets in touch.";

import { describeLocation, describeWants, isPlaceId, normaliseWants, placeById, regionName, regionOf } from "./house-swaps-geo.ts";

// ── Vocabulary (mirrors the database: the server rejects anything else) ─────────────────────────────────────────────────────────────────────────

export type AreaId = "lerwick_bressay" | "shetland_central" | "shetland_north" | "shetland_south" | "shetland_west" | "whalsay_skerries" | "yell_unst_fetlar";
export const AREAS: { id: AreaId; name: string }[] = [
  { id: "lerwick_bressay", name: "Lerwick & Bressay" },
  { id: "shetland_central", name: "Central Mainland" },
  { id: "shetland_north", name: "North Mainland" },
  { id: "shetland_south", name: "South Mainland" },
  { id: "shetland_west", name: "West Mainland / Westside" },
  { id: "whalsay_skerries", name: "Whalsay & Skerries" },
  { id: "yell_unst_fetlar", name: "Yell, Unst & Fetlar / North Isles" },
];
export const AREA_IDS: string[] = AREAS.map((a) => a.id);
export const areaName = (id: string | null | undefined): string => AREAS.find((a) => a.id === id)?.name ?? "Shetland";

export const PROPERTY_TYPES = [
  { id: "flat", label: "Flat" },
  { id: "house", label: "House" },
  { id: "bungalow", label: "Bungalow" },
  { id: "cottage", label: "Cottage" },
  { id: "maisonette", label: "Maisonette" },
  { id: "other", label: "Other" },
] as const;
export const TYPE_IDS: string[] = PROPERTY_TYPES.map((t) => t.id);
export const typeLabel = (id: string | null | undefined): string => PROPERTY_TYPES.find((t) => t.id === id)?.label ?? "Home";

export const FEATURES = [
  { id: "ground_floor", label: "Ground floor" },
  { id: "single_storey", label: "Single storey" },
  { id: "level_access", label: "Level access" },
  { id: "step_free_shower", label: "Step-free shower" },
  { id: "wheelchair_accessible", label: "Wheelchair accessible" },
  { id: "lift_access", label: "Lift access" },
  { id: "garden", label: "Garden" },
  { id: "parking", label: "Parking" },
] as const;
export const FEATURE_IDS: string[] = FEATURES.map((f) => f.id);
/** The accessibility-related features: grouped separately in the filters. */
export const ACCESS_FEATURE_IDS: string[] = ["ground_floor", "single_storey", "level_access", "step_free_shower", "wheelchair_accessible", "lift_access"];
export const featureLabel = (id: string): string => FEATURES.find((f) => f.id === id)?.label ?? id.replace(/_/g, " ");

export const LANDLORDS = [
  { id: "shetland_islands_council", label: "Shetland Islands Council" },
  { id: "hjaltland", label: "Hjaltland Housing Association" },
  { id: "other_social_landlord", label: "Another social landlord" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
] as const;
export const landlordLabel = (id: string | null | undefined): string | null => LANDLORDS.find((l) => l.id === id)?.label ?? null;

export const MAX_PHOTOS = 6;
export const LIMITS = { headline: 80, description: 1000, notes: 500, message: 1000, report: 500, reason: 500 } as const;
export const PAGE_SIZE = 12;

// ── Row shapes ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Photo = { path: string; alt: string | null };
export type MyPhoto = Photo & { id: string };

/** A row of the public view house_swap_listings_public. Deliberately has no owner. */
export type PublicListing = {
  id: string; headline: string | null; description: string | null;
  have_area_id: string; have_area_name: string; have_bedrooms: number; have_type: string; have_features: string[]; landlord_type: string | null;
  /** The community inside the home's region (null/absent when the member kept it broad, and on adverts made before communities existed). */
  have_place_id?: string | null; have_place_name?: string | null;
  want_area_ids: string[]; want_area_names: string[]; want_place_ids?: string[]; want_place_names?: string[]; want_min_bedrooms: number | null; want_max_bedrooms: number | null;
  want_types: string[]; want_features: string[]; want_notes: string | null;
  photos: Photo[]; last_confirmed_at: string; created_at: string;
  /** 'sample' = a fictional advert with no owner; 'preview' = made during the private preview; 'live'. */
  data_origin?: DataOrigin;
};
export type DataOrigin = "sample" | "preview" | "live";
export const isSample = (o: { data_origin?: string | null }): boolean => o.data_origin === "sample";

/** The one notice shown at the top of every House Swaps page during the private preview. */
export const PREVIEW_BANNER = "Private preview for invited reviewers. Adverts marked Sample are fictional. Anything you add is practice data and will be removed before this opens to everyone.";
export const SAMPLE_BADGE = "Sample advert";
export const SAMPLE_NO_MESSAGES = "This is a sample advert, so it can't receive messages. To try private messages, ask another reviewer to add an advert and message theirs.";

/** A staff-managed preview reviewer (admin_house_swap_invites). */
export type InviteRow = { email: string; note: string | null; added_at: string; has_account: boolean };

export type ModerationState = "pending" | "approved" | "rejected" | "hidden";
export type AdvertStatus = "active" | "paused" | "withdrawn";

/** my_house_swap() */
export type MyListing = Omit<PublicListing, "photos" | "have_area_name" | "want_area_names"> & {
  status: AdvertStatus; moderation_state: ModerationState; moderation_reason: string | null;
  have_area_name: string; want_area_names: string[]; photos: MyPhoto[];
  is_public: boolean; expires_at: string; unread_enquiries: number;
};

export type MatchKind = "mutual" | "has_what_you_want" | "wants_what_you_have";
export type MatchRow = {
  listing_id: string; match_kind: MatchKind; reasons: string[]; headline: string | null; have_area_id: string; have_area_name: string;
  have_place_id?: string | null; have_place_name?: string | null;
  have_bedrooms: number; have_type: string; have_features: string[]; want_area_ids?: string[]; want_area_names: string[]; want_place_ids?: string[]; want_place_names?: string[];
  want_min_bedrooms: number | null; want_max_bedrooms: number | null; last_confirmed_at: string; data_origin?: DataOrigin;
};

export type ThreadRow = {
  thread_id: string; listing_id: string; role: "sent" | "received"; status: "open" | "closed"; last_message_at: string; last_message: string | null; unread: number;
  about_area_name: string; about_bedrooms: number; about_type: string; about_headline: string | null;
  their_area_name: string | null; their_bedrooms: number | null; their_type: string | null;
};
export type ThreadMessage = { id: string; mine: boolean; body: string; created_at: string };

export type QueueRow = {
  id: string; moderation_state: ModerationState; status: AdvertStatus; moderation_reason: string | null; headline: string | null; description: string | null;
  have_area_name: string; have_place_name?: string | null; have_bedrooms: number; have_type: string; have_features: string[]; want_area_names: string[]; want_place_names?: string[];
  want_min_bedrooms: number | null; want_max_bedrooms: number | null; want_notes: string | null; photos: Photo[]; open_reports: number; updated_at: string; data_origin?: DataOrigin;
};

// ── Plain-English wording ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function bedroomsLabel(n: number | null | undefined): string {
  if (n == null) return "";
  if (n === 0) return "Bedsit / studio";
  return `${n} bedroom${n === 1 ? "" : "s"}`;
}
export const bedroomsShort = (n: number): string => (n === 0 ? "Studio" : `${n} bed`);

/** "3 bedrooms", "2 to 3 bedrooms", "3 or more bedrooms", "up to 2 bedrooms", or "any number of bedrooms". */
export function wantBedroomsText(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Any number of bedrooms";
  if (min != null && max != null) {
    if (min === max) return bedroomsLabel(min);
    return `${min === 0 ? "Studio" : min} to ${max} bedrooms`;
  }
  if (min != null) return `${min} or more bedrooms`;
  return `Up to ${max} bedroom${max === 1 ? "" : "s"}`;
}

export function wantAreasText(names: string[]): string {
  if (!names.length) return "Open to anywhere in Shetland";
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/** Where an advert's home is: "Scalloway, Central Mainland" when it names a community, the region alone otherwise. */
export function homeLocationText(x: { have_area_id?: string | null; have_area_name?: string | null; have_place_id?: string | null; have_place_name?: string | null }): string {
  if (x.have_place_id) return describeLocation(x.have_area_id, x.have_place_id);
  if (x.have_place_name) return x.have_area_name ? `${x.have_place_name}, ${x.have_area_name}` : x.have_place_name;
  return x.have_area_name || (x.have_area_id ? regionName(x.have_area_id) : "Shetland");
}

/** What an advert is looking for, by place: ids when the row has them (compact, grouped), the names the database gave otherwise. */
export function wantsText(x: { want_area_ids?: string[] | null; want_place_ids?: string[] | null; want_area_names?: string[] | null; want_place_names?: string[] | null }): string {
  if (x.want_area_ids || x.want_place_ids) return describeWants({ regionIds: x.want_area_ids ?? [], placeIds: x.want_place_ids ?? [] });
  const names = [...(x.want_area_names ?? []), ...(x.want_place_names ?? [])];
  return names.length ? wantAreasText(names) : "Anywhere in Shetland";
}

export function wantTypesText(types: string[]): string | null {
  if (!types.length) return null;
  const l = types.map((t) => typeLabel(t).toLowerCase());
  return l.length === 1 ? `A ${l[0]}` : `A ${l.slice(0, -1).join(", ")} or ${l[l.length - 1]}`;
}

/** The headline to show: the member's own, or a sensible plain one built from the facts (never empty). */
export function displayHeadline(l: { headline: string | null; have_bedrooms: number; have_type: string; have_area_name?: string | null; have_place_name?: string | null }): string {
  const h = l.headline?.trim();
  if (h) return h;
  const beds = l.have_bedrooms === 0 ? "Studio" : `${l.have_bedrooms}-bedroom`;
  return `${beds} ${typeLabel(l.have_type).toLowerCase()}${l.have_place_name || l.have_area_name ? ` in ${l.have_place_name || l.have_area_name}` : ""}`;
}

export const MATCH_KIND_LABEL: Record<MatchKind, string> = {
  mutual: "Could work both ways",
  has_what_you_want: "Has what you are looking for",
  wants_what_you_have: "Is looking for what you have",
};
export const MATCH_KIND_HELP: Record<MatchKind, string> = {
  mutual: "Their home fits what you asked for, and yours fits what they asked for.",
  has_what_you_want: "Their home fits what you asked for. Yours may not be what they want.",
  wants_what_you_have: "Your home fits what they asked for. Theirs may not be what you want.",
};
export const MATCH_KINDS: MatchKind[] = ["mutual", "has_what_you_want", "wants_what_you_have"];
export const MATCH_DISCLAIMER = "Possible matches, not a guarantee. We compare bedrooms, areas, property types and features only. Only you and the other tenant can decide if a swap is right.";

export const STATUS_PLAIN: Record<string, string> = { active: "Live", paused: "Paused", withdrawn: "Withdrawn", pending: "Waiting for review", approved: "Approved", rejected: "Not approved", hidden: "Hidden" };

/** One headline fact about the state of the member's own advert, in friendly words. */
export function advertStateText(l: Pick<MyListing, "status" | "moderation_state" | "is_public" | "moderation_reason">): { tone: "ok" | "wait" | "paused" | "bad"; title: string; body: string } {
  if (l.status === "paused") return { tone: "paused", title: "Paused", body: "Nobody can see your advert while it is paused. Resume it whenever you are ready." };
  if (l.moderation_state === "pending") return { tone: "wait", title: "Waiting for review", body: "A member of our team checks every new advert, and any change to its wording or photos, before it appears. This is usually quick." };
  if (l.moderation_state === "rejected") return { tone: "bad", title: "Not approved", body: l.moderation_reason ? `Reason: ${l.moderation_reason.trim().replace(/[.!?\s]+$/, "")}. Change your advert and save it to send it back for review.` : "Change your advert and save it to send it back for review." };
  if (l.moderation_state === "hidden") return { tone: "bad", title: "Hidden for now", body: l.moderation_reason ? `${l.moderation_reason.trim().replace(/[.!?\s]+$/, "")}.` : "Our team is looking at this advert." };
  if (l.is_public) return { tone: "ok", title: "Live", body: "Your advert is on the noticeboard." };
  return { tone: "wait", title: "Out of date", body: "Your advert has not been confirmed for a while, so it is not shown. Confirm that it is still available to put it back." };
}

// ── Dates ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
export function freshnessText(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const days = Math.floor((now.getTime() - t) / DAY);
  if (days <= 0) return "Confirmed today";
  if (days === 1) return "Confirmed yesterday";
  if (days < 14) return `Confirmed ${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks < 9 ? `Confirmed ${weeks} weeks ago` : `Confirmed ${Math.floor(days / 30)} months ago`;
}
export function formatDate(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }) : "";
}
export function formatWhen(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const sameDay = d.toLocaleDateString("en-GB", { timeZone: "Europe/London" }) === now.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}, ${time}`;
}
/** Days until the advert stops being shown (negative when already past). */
export const daysLeft = (expiresIso: string, now: Date = new Date()): number => Math.ceil((Date.parse(expiresIso) - now.getTime()) / DAY);

// ── Photos ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function photoUrl(path: string, base: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  return `${(base ?? "").replace(/\/$/, "")}/storage/v1/object/public/house-swap-photos/${path}`;
}
/** The path a member's photo must have: <their id>/<uuid>.jpg. */
export function newPhotoPath(userId: string, uuid: string): string {
  return `${userId}/${uuid}.jpg`;
}
/** Target size for the in-browser re-encode: longest edge 1600px, never enlarged. */
export function fitWithin(w: number, h: number, max = 1600): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}
export const PHOTO_TIP = "Photos of the inside (living room, kitchen, bedrooms) work best. Please avoid house numbers, street signs, people and number plates. We remove location data from photos before they are uploaded.";

// ── Contact-detail early warning (the database enforces this for real) ──────────────────────────────────────────────────────────────────────

export function hasContactDetails(text: string | null | undefined): boolean {
  if (!text) return false;
  return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)
    || /(https?:\/\/|www\.)/i.test(text)
    || /\b[a-z0-9-]+\.(com|co\.uk|org|net|scot|uk)\b/i.test(text)
    || /[0-9]{9,}/.test(text.replace(/[^0-9]/g, ""))
    || /(\+?\d[\d ().-]{7,}\d)/.test(text);
}

// ── Browse query (URL state) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type BrowseQuery = {
  area: string | null;        // where the home is: a broad region
  place: string | null;       // where the home is: a community (implies its region)
  beds: string | null;        // "0".."4" or "5+"
  types: string[];            // property types (any of)
  features: string[];         // features the home must have (all of)
  want: string | null;        // advert is looking to move to this region or community (a region id or a community id; or is open to anywhere)
  page: number;
};
type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const list = (v: string | string[] | undefined, allowed: string[]): string[] => {
  const raw = Array.isArray(v) ? v.join(",") : v ?? "";
  return [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => allowed.includes(s)))];
};
export const BEDROOM_FILTERS = ["0", "1", "2", "3", "4", "5+"] as const;

export function parseBrowseQuery(sp: SP): BrowseQuery {
  const place = first(sp.place), area = first(sp.area), want = first(sp.want), beds = first(sp.beds), page = parseInt(first(sp.page), 10);
  return {
    // A community wins over a region (it implies one); an unknown or mismatched id is ignored so old and hand-edited URLs still load.
    area: isPlaceId(place) ? regionOf(place) : AREA_IDS.includes(area) ? area : null,
    place: isPlaceId(place) ? place : null,
    beds: (BEDROOM_FILTERS as readonly string[]).includes(beds) ? beds : null,
    types: list(sp.type, TYPE_IDS),
    features: list(sp.feat, FEATURE_IDS),
    want: AREA_IDS.includes(want) || isPlaceId(want) ? want : null,
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 200) : 1,
  };
}
export function browseHref(q: Partial<BrowseQuery>, base = "/house-swaps"): string {
  const p = new URLSearchParams();
  if (q.place) p.set("place", q.place);
  else if (q.area) p.set("area", q.area);
  if (q.beds) p.set("beds", q.beds);
  if (q.types?.length) p.set("type", q.types.join(","));
  if (q.features?.length) p.set("feat", q.features.join(","));
  if (q.want) p.set("want", q.want);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}
export function activeFilterCount(q: BrowseQuery): number {
  return (q.area || q.place ? 1 : 0) + (q.beds ? 1 : 0) + (q.types.length ? 1 : 0) + (q.features.length ? 1 : 0) + (q.want ? 1 : 0);
}
/** Chips describing the filters in use; each carries the address that removes just that filter. */
export function activeFilterChips(q: BrowseQuery): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  if (q.place) out.push({ label: `Home in ${describeLocation(q.area, q.place)}`, href: browseHref({ ...q, area: null, place: null, page: 1 }) });
  else if (q.area) out.push({ label: `Home in ${areaName(q.area)}`, href: browseHref({ ...q, area: null, page: 1 }) });
  if (q.beds) out.push({ label: q.beds === "0" ? "Studio / bedsit" : q.beds === "5+" ? "5 or more bedrooms" : `${q.beds} bedroom${q.beds === "1" ? "" : "s"}`, href: browseHref({ ...q, beds: null, page: 1 }) });
  if (q.types.length) out.push({ label: q.types.map(typeLabel).join(" or "), href: browseHref({ ...q, types: [], page: 1 }) });
  for (const f of q.features) out.push({ label: featureLabel(f), href: browseHref({ ...q, features: q.features.filter((x) => x !== f), page: 1 }) });
  if (q.want) out.push({ label: `Looking to move to ${isPlaceId(q.want) ? describeLocation(null, q.want) : areaName(q.want)}`, href: browseHref({ ...q, want: null, page: 1 }) });
  return out;
}

// ── The advert form ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type AdvertForm = {
  headline: string; description: string;
  have_area_id: string; have_place_id: string; have_bedrooms: number | null; have_type: string; have_features: string[]; landlord_type: string;
  want_area_ids: string[]; want_place_ids: string[]; anywhere: boolean; want_min_bedrooms: number | null; want_max_bedrooms: number | null; want_types: string[]; want_features: string[]; want_notes: string;
  acknowledged: boolean;
};
export const EMPTY_ADVERT: AdvertForm = {
  headline: "", description: "", have_area_id: "", have_place_id: "", have_bedrooms: null, have_type: "", have_features: [], landlord_type: "",
  want_area_ids: [], want_place_ids: [], anywhere: true, want_min_bedrooms: null, want_max_bedrooms: null, want_types: [], want_features: [], want_notes: "", acknowledged: false,
};
export type AdvertErrors = Partial<Record<"have_area_id" | "have_bedrooms" | "have_type" | "headline" | "description" | "want_notes" | "want_bedrooms" | "acknowledged" | "want_area_ids", string>>;

export function advertFromListing(l: MyListing): AdvertForm {
  return {
    headline: l.headline ?? "", description: l.description ?? "",
    have_area_id: l.have_area_id, have_place_id: l.have_place_id ?? "", have_bedrooms: l.have_bedrooms, have_type: l.have_type, have_features: [...l.have_features], landlord_type: l.landlord_type ?? "",
    want_area_ids: [...l.want_area_ids], want_place_ids: [...(l.want_place_ids ?? [])], anywhere: l.want_area_ids.length === 0 && (l.want_place_ids ?? []).length === 0, want_min_bedrooms: l.want_min_bedrooms, want_max_bedrooms: l.want_max_bedrooms,
    want_types: [...l.want_types], want_features: [...l.want_features], want_notes: l.want_notes ?? "",
    acknowledged: false,
  };
}

export function validateAdvert(f: AdvertForm): { ok: boolean; errors: AdvertErrors } {
  const e: AdvertErrors = {};
  if (!AREA_IDS.includes(f.have_area_id)) e.have_area_id = "Please choose the area your home is in.";
  if (f.have_bedrooms == null || !Number.isInteger(f.have_bedrooms) || f.have_bedrooms < 0 || f.have_bedrooms > 8) e.have_bedrooms = "Please say how many bedrooms your home has.";
  if (f.have_place_id && regionOf(f.have_place_id) !== f.have_area_id) e.have_area_id = "Please choose the area your home is in.";
  if (!TYPE_IDS.includes(f.have_type)) e.have_type = "Please choose the type of home.";
  if (f.headline.trim().length > LIMITS.headline) e.headline = `Please keep the headline to ${LIMITS.headline} characters.`;
  else if (hasContactDetails(f.headline)) e.headline = CONTACT_RULE;
  if (f.description.trim().length > LIMITS.description) e.description = `Please keep this to ${LIMITS.description} characters.`;
  else if (hasContactDetails(f.description)) e.description = CONTACT_RULE;
  if (f.want_notes.trim().length > LIMITS.notes) e.want_notes = `Please keep this to ${LIMITS.notes} characters.`;
  else if (hasContactDetails(f.want_notes)) e.want_notes = CONTACT_RULE;
  if (f.want_min_bedrooms != null && f.want_max_bedrooms != null && f.want_min_bedrooms > f.want_max_bedrooms) e.want_bedrooms = "The smallest number of bedrooms can't be more than the largest.";
  if (!f.anywhere && f.want_area_ids.length === 0 && f.want_place_ids.length === 0) e.want_area_ids = "Choose at least one area or community, or pick \"Anywhere in Shetland\".";
  if (!f.acknowledged) e.acknowledged = "Please tick the box to say you understand.";
  return { ok: Object.keys(e).length === 0, errors: e };
}

/** The exact JSON the upsert_my_house_swap RPC takes. */
export function advertPayload(f: AdvertForm): Record<string, unknown> {
  const wants = normaliseWants({ regionIds: f.want_area_ids, placeIds: f.want_place_ids });
  return {
    acknowledged: f.acknowledged,
    headline: f.headline.trim() || null, description: f.description.trim() || null,
    have_area_id: f.have_area_id, have_place_id: f.have_place_id || null, have_bedrooms: f.have_bedrooms, have_type: f.have_type, have_features: f.have_features,
    landlord_type: f.landlord_type || null,
    want_area_ids: f.anywhere ? [] : wants.regionIds, want_place_ids: f.anywhere ? [] : wants.placeIds,
    want_min_bedrooms: f.want_min_bedrooms, want_max_bedrooms: f.want_max_bedrooms,
    want_types: f.want_types, want_features: f.want_features, want_notes: f.want_notes.trim() || null,
  };
}

/** A live preview model of how the advert will read, built from the form alone. */
export function advertPreview(f: AdvertForm) {
  const have_area_name = f.have_area_id ? describeLocation(f.have_area_id, f.have_place_id) : "";
  return {
    headline: f.headline.trim() || (f.have_bedrooms != null && f.have_type ? displayHeadline({ headline: null, have_bedrooms: f.have_bedrooms, have_type: f.have_type, have_area_name: f.have_place_id ? placeById(f.have_place_id)?.name ?? null : have_area_name || null }) : "Your headline will appear here"),
    haveLine: [f.have_bedrooms == null ? null : bedroomsLabel(f.have_bedrooms), f.have_type ? typeLabel(f.have_type) : null, have_area_name || null].filter(Boolean).join(" · "),
    haveFeatures: f.have_features.map(featureLabel),
    wantAreas: f.anywhere ? "Anywhere in Shetland" : describeWants({ regionIds: f.want_area_ids, placeIds: f.want_place_ids }),
    wantBeds: wantBedroomsText(f.want_min_bedrooms, f.want_max_bedrooms),
    wantTypes: wantTypesText(f.want_types),
    wantFeatures: f.want_features.map(featureLabel),
  };
}

export const toggle = (arr: string[], v: string): string[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

// ── Enquiries, reports, moderation ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export const REPORT_REASONS = [
  { id: "spam", label: "Spam or not a real advert" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hateful content" },
  { id: "sexual", label: "Sexual content" },
  { id: "violence", label: "Threats or violence" },
  { id: "illegal", label: "Something illegal (for example asking for money)" },
  { id: "self_harm", label: "Someone may be at risk of harm" },
  { id: "other", label: "Something else" },
] as const;
export const REPORT_REASON_IDS: string[] = REPORT_REASONS.map((r) => r.id);

export const ENQUIRY_STARTER = "Hello, I saw your advert and think a swap could suit us both. ";
export const SAFE_CHAT_NOTE = "Keep chatting here. Only share your phone number or address when you are comfortable. Remember that any swap needs both landlords' written consent, so speak to your landlord before you agree anything. Never send money.";

export function isUuid(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function validateMessage(body: string): string | null {
  const t = body.trim();
  if (!t) return "Please write a message.";
  if (t.length > LIMITS.message) return `Please keep your message to ${LIMITS.message} characters.`;
  return null;
}

export const MODERATION_TABS = [
  { id: "pending", label: "Pending" },
  { id: "reported", label: "Reported" },
  { id: "hidden", label: "Hidden" },
  { id: "rejected", label: "Rejected" },
  { id: "approved", label: "Approved" },
] as const;
export type ModerationTab = (typeof MODERATION_TABS)[number]["id"];
export const parseModerationTab = (v: string | string[] | undefined): ModerationTab => {
  const s = first(v);
  return (MODERATION_TABS.find((t) => t.id === s)?.id ?? "pending") as ModerationTab;
};

/** A flash message carried across a redirect, never HTML. Only known words get through so the query string cannot be used to write a page. */
export function cleanFlash(v: string | string[] | undefined): string | null {
  const s = first(v).trim();
  return s && s.length <= 300 ? s : null;
}

/** Where to send someone to sign in and come straight back. Only local paths are allowed as `next`. */
export function signInHref(next: string): string {
  const safe = next.startsWith("/") && !next.startsWith("//") && !/[\t\r\n\\]/.test(next) ? next : "/house-swaps";
  return `/sign-in?next=${encodeURIComponent(safe)}`;
}

/** What the other side's advert is, in a few words: never a name. */
export function otherSide(t: ThreadRow): { title: string; sub: string } {
  if (t.role === "sent") return { title: t.about_headline?.trim() || `${bedroomsShort(t.about_bedrooms)} ${typeLabel(t.about_type).toLowerCase()}`, sub: `${bedroomsShort(t.about_bedrooms)} · ${typeLabel(t.about_type)} · ${t.about_area_name}` };
  if (t.their_bedrooms != null) return { title: "Someone interested in your advert", sub: `Their home: ${bedroomsShort(t.their_bedrooms)} · ${typeLabel(t.their_type)} · ${t.their_area_name ?? "Shetland"}` };
  return { title: "Someone interested in your advert", sub: "They don't have an advert yet" };
}

/** The menu/footer entry. Only added to the site navigation while house_swaps_enabled() is true (see app/layout.tsx). */
export const HOUSE_SWAPS_NAV = { key: "house-swaps", label: "House Swaps", href: "/house-swaps", color: "#0e7a94", token: "teal", blurb: "A free noticeboard for tenants looking to swap homes." } as const;

/** An open report as listed for staff (admin_house_swap_reports). */
export type ReportRow = { report_id: string; kind: "listing" | "thread"; content_id: string; listing_id: string | null; reason: string; details: string | null; created_at: string; advert_summary: string | null };
export const reasonLabel = (id: string): string => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;
