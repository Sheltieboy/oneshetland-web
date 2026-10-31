/**
 * notices-alerts.ts — the website's pure model of the Notices & Alerts system (backend contract: oneshetland-notices-alerts/docs/notices-alerts-contract.md).
 *
 * Everything here is pure (no I/O, no React) so it runs in the app, in server actions and under `node --test`:
 *   - RPC rows -> the card models the pages render, including the attribution adapter for the RPC's `publisher` object
 *   - the AREA ARGUMENT rules (null = unfiltered, [] = Shetland-wide only, [ids] = those areas) - three different things, never conflated
 *   - the /notices query-string model (shareable URLs) and "Show more" chunking
 *   - the funeral view-model (a whitelist: nothing private can pass through it) and the submission payload builder
 *   - client-side mirrors of the server's validation rules, FOR GUIDANCE ONLY - the database is the authority and its message is always shown
 *
 * Attribution: the RPC's `publisher` object is authoritative ({kind,label,is_official_source,source_label,source_url,byline}). The shared helpers
 * lib/notice-publisher.ts / lib/notice-feed.ts are pinned and know nothing of kind "official", so they are NOT edited: this file adapts the RPC
 * object instead. Identity is never inferred from joins.
 */
import { noticeHref } from "./home-curation";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type RpcPublisher = {
  kind?: string | null; label?: string | null; byline?: string | null;
  is_official_source?: boolean | null; source_label?: string | null; source_url?: string | null;
} | null | undefined;

/** A row of get_public_notices (get_essential_alerts returns the subset of these fields). */
export type PublicNoticeRow = {
  id: string; title: string; body?: string | null; action_text?: string | null; severity?: string | null;
  category?: string | null; category_label?: string | null;
  published_at?: string | null; starts_at?: string | null; expires_at?: string | null; review_at?: string | null; link_url?: string | null;
  level?: number | null; is_essential_active?: boolean | null; publisher?: RpcPublisher;
  area_ids?: string[] | null; area_names?: string[] | null;
  publisher_hub_id?: string | null; publisher_business_id?: string | null; event_id?: string | null; campaign_id?: string | null;
  image_url?: string | null; publisher_logo_url?: string | null; publisher_brand_color?: string | null; hub_slug?: string | null; business_slug?: string | null;
};

export type AttributionKind = "hub" | "business" | "person" | "platform" | "official";
export type NoticeAttribution = {
  kind: AttributionKind;
  label: string;
  byline: string;
  isOfficialSource: boolean;
  sourceLabel: string | null;
  /** Only ever a valid https URL. */
  sourceUrl: string | null;
  logoUrl: string | null;
  brandColor: string | null;
};

export type NoticeDestination = { href: string; label: string };

export type NoticeCardModel = {
  id: string;
  title: string;
  body: string;
  actionText: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  /** 1 essential (active), 2 health & official, 3 community. */
  level: 1 | 2 | 3;
  isEssential: boolean;
  attribution: NoticeAttribution;
  areaIds: string[];
  areaNames: string[];
  /** "Voe, Brae +1", or "Shetland-wide" when the notice names no area. */
  areaSummary: string;
  publishedAt: string | null;
  expiresAt: string | null;
  reviewAt: string | null;
  /** The publisher's own link (https only) - separate from the attribution's source link. */
  linkUrl: string | null;
  /** Where the notice itself goes (fundraiser -> event -> hub -> business), or null: then it is a plain block. */
  destination: NoticeDestination | null;
};

/* ── URLs ──────────────────────────────────────────────────────────────────── */

/** https only (the contract's rule for source links and publisher links). Anything else is not shown as a link. */
export function safeHttpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname) return null;
    return u.toString();
  } catch { return null; }
}

/* ── Attribution adapter ───────────────────────────────────────────────────── */

const KINDS: readonly string[] = ["hub", "business", "person", "platform", "official"];
const clean = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

const FALLBACK_LABEL: Record<AttributionKind, string> = {
  hub: "Community hub", business: "Local business", person: "A OneShetland member", platform: "OneShetland", official: "Official source",
};

/** The RPC's `publisher` object -> how to show who a notice is from. Missing/odd values fall back to accurate, approved labels (never "Member"). */
export function adaptPublisher(row: Pick<PublicNoticeRow, "publisher" | "publisher_logo_url" | "publisher_brand_color">): NoticeAttribution {
  const p = row.publisher ?? null;
  const kind: AttributionKind = p && typeof p.kind === "string" && KINDS.includes(p.kind) ? (p.kind as AttributionKind) : "platform";
  const label = clean(p?.label) ?? FALLBACK_LABEL[kind];
  const isOfficialSource = kind === "official" || p?.is_official_source === true;
  let byline = clean(p?.byline);
  if (!byline) {
    byline = kind === "official" ? `Issued by ${label}`
      : kind === "platform" && isOfficialSource ? `Source: ${label}`
      : kind === "platform" ? "Posted by OneShetland"
      : `Posted by ${label}`;
  }
  const branded = kind === "hub" || kind === "business";
  return {
    kind, label, byline, isOfficialSource,
    sourceLabel: clean(p?.source_label),
    sourceUrl: safeHttpsUrl(p?.source_url),
    logoUrl: branded ? clean(row.publisher_logo_url) : null,
    brandColor: branded ? clean(row.publisher_brand_color) : null,
  };
}

/** Fundraiser -> event -> hub -> business -> none. Hub/business only when the DATABASE says that is the publisher (kind), never from a stray id. */
export function noticeDestination(row: PublicNoticeRow, attribution: NoticeAttribution = adaptPublisher(row)): NoticeDestination | null {
  const href = noticeHref({
    campaign_id: row.campaign_id ?? null,
    event_id: row.event_id ?? null,
    hub: attribution.kind === "hub" && row.publisher_hub_id ? { id: row.publisher_hub_id, slug: row.hub_slug ?? null } : null,
    business: attribution.kind === "business" && row.publisher_business_id ? { id: row.publisher_business_id, slug: row.business_slug ?? null } : null,
  });
  if (!href) return null;
  const label = row.campaign_id ? "View fundraiser" : row.event_id ? "View event" : attribution.kind === "hub" ? "View hub" : "View business";
  return { href, label };
}

/* ── Areas ─────────────────────────────────────────────────────────────────── */

/** First two names then "+N"; no names = the notice is not tied to a place = Shetland-wide. */
export function areaSummary(names: readonly string[] | null | undefined, max = 2): string {
  const list = (names ?? []).map((n) => n.trim()).filter(Boolean);
  if (list.length === 0) return "Shetland-wide";
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} +${list.length - max}`;
}

const AREA_ID = /^[a-z][a-z0-9_]*$/;
export const SHETLAND_WIDE = "shetland_wide";
export const MAX_MEMBER_AREAS = 12;

/** Keep only well-formed ids, once each, in order. (The server still decides which exist.) */
export function cleanAreaIds(ids: readonly unknown[] | null | undefined): string[] {
  const out: string[] = [];
  for (const v of ids ?? []) if (typeof v === "string" && AREA_ID.test(v) && v.length <= 64 && !out.includes(v)) out.push(v);
  return out;
}

/**
 * The `p_area_ids` argument, which has THREE meanings in the contract:
 *   null       unfiltered - every public notice
 *   []         Shetland-wide notices only
 *   ['voe',..] those areas, anything inside them, anything containing them, plus Shetland-wide
 * "Not signed in", "signed in with no areas chosen" and "the member's chosen areas" must therefore not be collapsed into one another.
 */
export type AreaScope = { mode: "all" } | { mode: "wide" } | { mode: "areas"; ids: string[] };
export const SCOPE_ALL: AreaScope = { mode: "all" };

export function rpcAreaArg(scope: AreaScope): string[] | null {
  if (scope.mode === "all") return null;
  if (scope.mode === "wide") return [];
  return scope.ids.length ? [...scope.ids] : null;   // an empty list of ids would mean "Shetland-wide only": never produced by accident
}

/**
 * The homepage/browsing default for a member: their chosen areas when they have any; otherwise UNFILTERED (null). A visitor and a member who has
 * not chosen areas both still see every public alert when browsing - choosing no areas narrows nothing (it only limits what is *pushed*: Shetland-wide only).
 */
export function memberBrowseScope(memberAreas: readonly string[] | null | undefined): AreaScope {
  const ids = cleanAreaIds(memberAreas ?? []);
  return ids.length ? { mode: "areas", ids } : SCOPE_ALL;
}

/* ── Categories (the nine canonical ids in notice_categories) ──────────────── */

export const NOTICE_CATEGORIES: { id: string; label: string }[] = [
  { id: "travel_transport", label: "Travel & transport" },
  { id: "health", label: "Health" },
  { id: "public_services", label: "Council & public services" },
  { id: "schools_education", label: "Schools & education" },
  { id: "community", label: "Community" },
  { id: "consultations_funding", label: "Consultations & funding" },
  { id: "lost_found", label: "Lost & found" },
  { id: "appeals_volunteering", label: "Appeals & volunteering" },
  { id: "other", label: "Other" },
];
export const categoryLabel = (id: string | null | undefined): string | null => NOTICE_CATEGORIES.find((c) => c.id === id)?.label ?? null;

/* ── Row -> card model ─────────────────────────────────────────────────────── */

export function toNoticeCard(row: PublicNoticeRow): NoticeCardModel {
  const attribution = adaptPublisher(row);
  const ids = row.area_ids ?? [];
  const names = (row.area_names ?? []).filter((n) => typeof n === "string" && n.trim());
  const level = row.level === 1 || row.level === 2 || row.level === 3 ? row.level : row.is_essential_active ? 1 : attribution.isOfficialSource ? 2 : 3;
  return {
    id: row.id,
    title: (row.title ?? "").trim(),
    body: (row.body ?? "").trim(),
    actionText: clean(row.action_text),
    categoryId: clean(row.category),
    categoryLabel: clean(row.category_label) ?? categoryLabel(row.category),
    level,
    isEssential: row.is_essential_active === true,
    attribution,
    areaIds: ids,
    areaNames: names,
    areaSummary: areaSummary(names),
    publishedAt: row.published_at ?? null,
    expiresAt: row.expires_at ?? null,
    reviewAt: row.review_at ?? null,
    linkUrl: safeHttpsUrl(row.link_url),
    destination: noticeDestination(row, attribution),
  };
}

/** Rows from an RPC, defensively: anything that is not an array of objects with an id is "no notices". */
export function toNoticeCards(data: unknown): NoticeCardModel[] {
  if (!Array.isArray(data)) return [];
  return data.filter((r): r is PublicNoticeRow => !!r && typeof r === "object" && typeof (r as { id?: unknown }).id === "string").map(toNoticeCard);
}

export const HOME_NOTICE_LIMIT = 6;

/**
 * The homepage grid: newest first, never an active essential alert (those live in the reserved top slot - they must never appear twice),
 * at most six. `essentialIds` also excludes alerts the slot is showing even if a row's own flag were missing.
 */
export function composeHomeNotices(all: readonly NoticeCardModel[], essentialIds: Iterable<string> = [], limit = HOME_NOTICE_LIMIT): NoticeCardModel[] {
  const ess = new Set(essentialIds);
  return all.filter((n) => !n.isEssential && !ess.has(n.id)).slice(0, limit);
}

/** Precedence of the top of the homepage, in one place (see app/page.tsx): 1 Essential Alert slot -> 2 hero ... -> community band: partner strip, then notices. */
export function homeTopOfPage(input: { essentialCount: number; partnerAlertCount: number }) {
  return { showEssentialSlot: input.essentialCount > 0, showPartnerStrip: input.partnerAlertCount > 0 };
}

/* ── Dates ─────────────────────────────────────────────────────────────────── */

const LONDON = "Europe/London";
export function formatNoticeDate(iso: string | null | undefined, now: Date | number = new Date()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = new Date(now).getTime() - t;
  if (diff >= 0 && diff < 60 * 60_000) { const m = Math.max(1, Math.floor(diff / 60_000)); return `${m} min ago`; }
  if (diff >= 0 && diff < 24 * 3_600_000) { const h = Math.floor(diff / 3_600_000); return `${h} h ago`; }
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: LONDON });
}
export function formatNoticeDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: LONDON })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: LONDON })}`;
}

/* ── The /notices query string ─────────────────────────────────────────────── */

export const NOTICE_TABS = ["all", "essential", "official", "community", "funeral"] as const;
export type NoticeTab = (typeof NOTICE_TABS)[number];
export const TAB_LABEL: Record<NoticeTab, string> = {
  all: "All", essential: "Essential alerts", official: "Health & official", community: "Community", funeral: "Deaths & funeral",
};
export const PAGE_SIZE = 20;
export const MAX_PAGES = 10;
export const RPC_MAX_LIMIT = 50;

export type AreaParam = { mode: "all" } | { mode: "my" } | { mode: "wide" } | { mode: "ids"; ids: string[] };
export type NoticesQuery = { tab: NoticeTab; area: AreaParam; category: string | null; page: number };

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** URL state -> a validated query. Anything unrecognised falls back to the default (never an error, never an injection into an RPC argument). */
export function parseNoticesQuery(sp: Record<string, string | string[] | undefined> | null | undefined): NoticesQuery {
  const s = sp ?? {};
  const tabRaw = first(s.tab);
  const tab = (NOTICE_TABS as readonly string[]).includes(tabRaw ?? "") ? (tabRaw as NoticeTab) : "all";
  const areaRaw = (first(s.area) ?? "").trim();
  let area: AreaParam = { mode: "all" };
  if (areaRaw === "my") area = { mode: "my" };
  else if (areaRaw === "wide") area = { mode: "wide" };
  else if (areaRaw) { const ids = cleanAreaIds(areaRaw.split(",")).slice(0, MAX_MEMBER_AREAS); if (ids.length) area = { mode: "ids", ids }; }
  const catRaw = first(s.cat);
  const category = NOTICE_CATEGORIES.some((c) => c.id === catRaw) ? (catRaw as string) : null;
  const pageN = Number.parseInt(first(s.page) ?? "1", 10);
  const page = Number.isFinite(pageN) ? Math.min(MAX_PAGES, Math.max(1, pageN)) : 1;
  return { tab, area, category, page };
}

/** A query -> its URL (defaults omitted so shared links stay short). */
export function noticesHref(q: Partial<NoticesQuery>, base = "/notices"): string {
  const p = new URLSearchParams();
  if (q.tab && q.tab !== "all") p.set("tab", q.tab);
  if (q.area?.mode === "my") p.set("area", "my");
  else if (q.area?.mode === "wide") p.set("area", "wide");
  else if (q.area?.mode === "ids" && q.area.ids.length) p.set("area", q.area.ids.join(","));
  if (q.category) p.set("cat", q.category);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * The RPC area argument for a query. "My areas" with no areas chosen means no narrowing (null), exactly like browsing as a visitor;
 * "Shetland-wide only" is the only way to ask for [].
 */
export function areaArgForQuery(area: AreaParam, memberAreas: readonly string[] | null | undefined): string[] | null {
  if (area.mode === "all") return null;
  if (area.mode === "wide") return rpcAreaArg({ mode: "wide" });
  if (area.mode === "my") return rpcAreaArg(memberBrowseScope(memberAreas));
  return rpcAreaArg({ mode: "areas", ids: area.ids });
}

/** "Show more": page N shows the first N*PAGE_SIZE rows, fetched in chunks the RPC allows (it clamps at 50). One extra row tells us if there is more. */
export function planChunks(page: number, size = PAGE_SIZE, max = RPC_MAX_LIMIT): { offset: number; limit: number }[] {
  const total = Math.max(1, page) * size + 1;
  const out: { offset: number; limit: number }[] = [];
  for (let offset = 0; offset < total; offset += max) out.push({ offset, limit: Math.min(max, total - offset) });
  return out;
}
export function sliceForPage<T>(rows: readonly T[], page: number, size = PAGE_SIZE): { rows: T[]; hasMore: boolean } {
  const want = Math.max(1, page) * size;
  return { rows: rows.slice(0, want), hasMore: rows.length > want };
}

/* ── Funeral notices ───────────────────────────────────────────────────────── */

export type FuneralRow = {
  id: string; full_name: string; preferred_name?: string | null; photo_url?: string | null; born_on?: string | null; died_on?: string | null;
  announcement?: string | null; service_kind?: string | null; service_venue?: string | null; service_at?: string | null; service_notes?: string | null;
  family_requests?: string | null; donation_info?: string | null; donation_url?: string | null; area_id?: string | null; area_name?: string | null; published_at?: string | null;
};

export const SERVICE_KIND_LABEL: Record<string, string> = {
  funeral: "Funeral service", burial: "Burial", cremation: "Cremation", memorial: "Memorial service", private: "Private service",
};

export type FuneralView = {
  id: string;
  fullName: string;
  /** Shown as "known as ..." only when it differs from the full name. */
  knownAs: string | null;
  photoUrl: string | null;
  lifeSpan: string | null;
  announcement: string | null;
  /** null unless the family approved publishing the arrangements AND the database returned some. */
  arrangements: { kindLabel: string | null; venue: string | null; when: string | null; notes: string | null } | null;
  familyRequests: string | null;
  donationInfo: string | null;
  donationUrl: string | null;
  areaName: string | null;
  publishedAt: string | null;
};

const dateOnly = (iso: string | null | undefined): string | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

export function lifeSpan(born: string | null | undefined, died: string | null | undefined): string | null {
  const b = dateOnly(born), d = dateOnly(died);
  if (b && d) return `${b} – ${d}`;
  if (d) return `Died ${d}`;
  if (b) return `Born ${b}`;
  return null;
}

export function formatServiceWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: LONDON })} at ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: LONDON })}`;
}

/**
 * A public funeral row -> what the template renders. It READS NAMED FIELDS ONLY: a row that somehow carried a private field (a phone number, a
 * verification note) could not leak through here. Optional parts are omitted, never rendered as "Unknown"/empty headings.
 */
export function funeralView(row: FuneralRow): FuneralView {
  const full = clean(row.full_name) ?? "";
  const pref = clean(row.preferred_name);
  const kind = clean(row.service_kind);
  const venue = clean(row.service_venue), when = formatServiceWhen(row.service_at), notes = clean(row.service_notes);
  const hasArr = !!(kind || venue || when || notes);
  return {
    id: row.id,
    fullName: full,
    knownAs: pref && pref.toLowerCase() !== full.toLowerCase() ? pref : null,
    photoUrl: safeHttpsUrl(row.photo_url),
    lifeSpan: lifeSpan(row.born_on, row.died_on),
    announcement: clean(row.announcement),
    arrangements: hasArr ? { kindLabel: kind ? SERVICE_KIND_LABEL[kind] ?? null : null, venue, when, notes } : null,
    familyRequests: clean(row.family_requests),
    donationInfo: clean(row.donation_info),
    donationUrl: safeHttpsUrl(row.donation_url),
    areaName: clean(row.area_name),
    publishedAt: row.published_at ?? null,
  };
}
export function toFuneralViews(data: unknown): FuneralView[] {
  if (!Array.isArray(data)) return [];
  return data.filter((r): r is FuneralRow => !!r && typeof r === "object" && typeof (r as { id?: unknown }).id === "string").map(funeralView);
}

/* ── Funeral submission (form -> RPC payload, plus a guidance-only validation mirror) ─────────────────────── */

export type FuneralFormInput = {
  fullName: string; preferredName: string; photoUrl: string; bornOn: string; diedOn: string; announcement: string; areaId: string;
  /** The explicit "I want to publish the funeral arrangements" choice. When false NO arrangement field is sent at all. */
  publishArrangements: boolean;
  serviceKind: string; serviceVenue: string; serviceAt: string; serviceNotes: string;
  familyRequests: string; donationInfo: string; donationUrl: string;
  announceInNotifications: boolean; announceNameInPreview: boolean;
  submitterRole: "family" | "funeral_director"; submitterName: string; submitterRelationship: string; submitterPhone: string; submitterEmail: string;
  familyAuthorised: boolean;
};

export const EMPTY_FUNERAL_FORM: FuneralFormInput = {
  fullName: "", preferredName: "", photoUrl: "", bornOn: "", diedOn: "", announcement: "", areaId: "", publishArrangements: false,
  serviceKind: "", serviceVenue: "", serviceAt: "", serviceNotes: "", familyRequests: "", donationInfo: "", donationUrl: "",
  announceInNotifications: false, announceNameInPreview: false, submitterRole: "family", submitterName: "", submitterRelationship: "",
  submitterPhone: "", submitterEmail: "", familyAuthorised: false,
};

const t = (s: string) => s.trim();
const orNull = (s: string): string | null => (t(s) ? t(s) : null);

/** The jsonb for submit_funeral_notice. Blank optional fields are left OUT (the server stores null); arrangements only on the explicit choice. */
export function buildFuneralPayload(f: FuneralFormInput): Record<string, unknown> {
  const p: Record<string, unknown> = {
    full_name: t(f.fullName), submitter_name: t(f.submitterName), submitter_role: f.submitterRole, family_authorised: f.familyAuthorised === true,
    service_public: f.publishArrangements === true,
    announce_in_notifications: f.announceInNotifications === true,
    // The name may only appear in a push preview if the family also allowed a notification at all.
    announce_name_in_preview: f.announceInNotifications === true && f.announceNameInPreview === true,
  };
  const opt: [string, string][] = [
    ["preferred_name", f.preferredName], ["photo_url", f.photoUrl], ["born_on", f.bornOn], ["died_on", f.diedOn], ["announcement", f.announcement],
    ["area_id", f.areaId], ["family_requests", f.familyRequests], ["donation_info", f.donationInfo], ["donation_url", f.donationUrl],
    ["submitter_relationship", f.submitterRelationship], ["submitter_phone", f.submitterPhone], ["submitter_email", f.submitterEmail],
  ];
  for (const [k, v] of opt) { const x = orNull(v); if (x) p[k] = x; }
  if (f.publishArrangements) {
    const arr: [string, string][] = [["service_kind", f.serviceKind], ["service_venue", f.serviceVenue], ["service_notes", f.serviceNotes]];
    for (const [k, v] of arr) { const x = orNull(v); if (x) p[k] = x; }
    const at = orNull(f.serviceAt);
    if (at) { const d = new Date(at); if (!Number.isNaN(d.getTime())) p.service_at = d.toISOString(); }
  }
  return p;
}

export type FieldErrors = Record<string, string>;

/** Mirrors the server's checks to help people before they submit. The server remains the authority and its message is always shown too. */
export function validateFuneralForm(f: FuneralFormInput, now: Date = new Date()): FieldErrors {
  const e: FieldErrors = {};
  if (t(f.fullName).length < 2 || t(f.fullName).length > 120) e.fullName = "Please give the full name (2 to 120 characters).";
  if (t(f.submitterName).length < 2 || t(f.submitterName).length > 120) e.submitterName = "Please give your name (2 to 120 characters).";
  if (!t(f.submitterPhone) && !t(f.submitterEmail)) e.contact = "Please give a phone number or an email address, so we can check the details with you. It is never published.";
  if (!f.familyAuthorised) e.familyAuthorised = "Please confirm you are authorised to make this announcement.";
  if (t(f.announcement).length > 1500) e.announcement = "The announcement can be up to 1,500 characters.";
  if (/(https?:\/\/|www\.)/i.test(f.announcement)) e.announcement = "Please leave web addresses out of the announcement.";
  if (t(f.photoUrl) && !safeHttpsUrl(f.photoUrl)) e.photoUrl = "The photograph link must start with https://";
  if (t(f.donationUrl) && !safeHttpsUrl(f.donationUrl)) e.donationUrl = "The donation link must start with https://";
  if (f.bornOn && f.diedOn && f.bornOn > f.diedOn) e.bornOn = "The date of birth cannot be after the date of death.";
  if (f.diedOn && f.diedOn > now.toISOString().slice(0, 10)) e.diedOn = "The date of death cannot be in the future.";
  if (t(f.familyRequests).length > 500) e.familyRequests = "Up to 500 characters.";
  if (t(f.donationInfo).length > 500) e.donationInfo = "Up to 500 characters.";
  if (f.publishArrangements) {
    if (t(f.serviceVenue).length > 200) e.serviceVenue = "Up to 200 characters.";
    if (t(f.serviceNotes).length > 500) e.serviceNotes = "Up to 500 characters.";
  }
  return e;
}

/* ── Official publisher form (guidance mirror of official_validate_notice) ─────────────────────────────── */

export type OfficialNoticeInput = {
  title: string; body: string; actionText: string; category: string; areaIds: string[];
  startsAt: Date | null; expiresAt: Date | null; reviewAt: Date | null; linkUrl: string; essential: boolean;
};

const DAY = 86_400_000;
/** Limits are the server's; the server enforces them all and its message is shown verbatim when it disagrees. */
export function validateOfficialNotice(i: OfficialNoticeInput, ctx: { canEssential: boolean; now?: Date }): FieldErrors {
  const e: FieldErrors = {};
  const now = ctx.now ?? new Date();
  const start = i.startsAt ?? now;
  if (i.essential && !ctx.canEssential) e.essential = "This organisation or account cannot issue Essential Alerts.";
  const tl = t(i.title).length; if (tl < 5 || tl > 120) e.title = "The title must be 5 to 120 characters.";
  const bl = t(i.body).length; if (bl < 20 || bl > 4000) e.body = "The explanation must be 20 to 4,000 characters.";
  if (!NOTICE_CATEGORIES.some((c) => c.id === i.category)) e.category = "Choose a category.";
  const areas = cleanAreaIds(i.areaIds);
  if (areas.length === 0) e.areaIds = "Choose at least one affected area, or Shetland-wide.";
  else if (areas.includes(SHETLAND_WIDE) && areas.length > 1) e.areaIds = "Shetland-wide cannot be combined with specific areas.";
  if (t(i.linkUrl) && !safeHttpsUrl(i.linkUrl)) e.linkUrl = "The link must be a plain https address.";
  if (i.startsAt && (i.startsAt.getTime() < now.getTime() - DAY || i.startsAt.getTime() > now.getTime() + 30 * DAY)) e.startsAt = "The start time must be within the next 30 days.";
  if (!i.expiresAt || i.expiresAt.getTime() <= start.getTime()) e.expiresAt = "An official notice needs an expiry after it starts.";
  else if (i.expiresAt.getTime() > start.getTime() + 180 * DAY) e.expiresAt = "An official notice cannot run for more than 180 days.";
  if (i.essential) {
    if (i.expiresAt && i.expiresAt.getTime() > start.getTime() + 7 * DAY) e.expiresAt = "An Essential Alert cannot run for more than 7 days. Re-issue it if it is still needed.";
    if (!i.reviewAt || i.reviewAt.getTime() <= start.getTime() || (i.expiresAt && i.reviewAt.getTime() > i.expiresAt.getTime())) e.reviewAt = "An Essential Alert needs a review time between its start and its expiry.";
    const al = t(i.actionText).length; if (al < 10 || al > 500) e.actionText = "Say what people need to do (10 to 500 characters).";
  } else if (t(i.actionText).length > 500) e.actionText = "Up to 500 characters.";
  return e;
}

/** Arguments for official_publish_notice. */
export function officialPublishArgs(publisherId: string, i: OfficialNoticeInput): Record<string, unknown> {
  return {
    p_publisher: publisherId, p_title: t(i.title), p_body: t(i.body), p_category: i.category, p_area_ids: cleanAreaIds(i.areaIds),
    p_expires_at: i.expiresAt ? i.expiresAt.toISOString() : null, p_starts_at: i.startsAt ? i.startsAt.toISOString() : null,
    p_link_url: orNull(i.linkUrl), p_action_text: orNull(i.actionText), p_is_essential: i.essential === true,
    p_review_at: i.essential && i.reviewAt ? i.reviewAt.toISOString() : null,
  };
}

/* ── Member preferences ────────────────────────────────────────────────────── */

export type NoticePrefs = {
  essential_alerts: boolean; official_notices: boolean; community_notices: boolean; community_categories: string[] | null; funeral_notices: boolean;
};
export const DEFAULT_NOTICE_PREFS: NoticePrefs = { essential_alerts: false, official_notices: false, community_notices: false, community_categories: null, funeral_notices: false };

export function toNoticePrefs(data: unknown): NoticePrefs {
  if (!data || typeof data !== "object") return { ...DEFAULT_NOTICE_PREFS };
  const d = data as Record<string, unknown>;
  const cats = Array.isArray(d.community_categories) ? d.community_categories.filter((c): c is string => typeof c === "string") : null;
  return {
    essential_alerts: d.essential_alerts === true, official_notices: d.official_notices === true, community_notices: d.community_notices === true,
    community_categories: cats, funeral_notices: d.funeral_notices === true,
  };
}

/** set_my_notice_prefs arguments: "all categories" is its own explicit flag, so an empty chip selection is never read as "everything". */
export function prefsArgs(p: NoticePrefs): Record<string, unknown> {
  const all = p.community_categories === null || p.community_categories.length === 0;
  return {
    p_essential: p.essential_alerts, p_official: p.official_notices, p_community: p.community_notices, p_funeral: p.funeral_notices,
    p_categories: all ? null : p.community_categories, p_all_community_categories: all,
  };
}
