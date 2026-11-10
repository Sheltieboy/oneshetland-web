/**
 * Pure input validators for the organiser area. Shared by the forms (instant feedback) and by the server actions (authoritative pre-check before the
 * database, which remains the final authority). No I/O, no framework imports, so they are unit-tested directly.
 *
 * Every validator returns { ok: true, value } with a cleaned value, or { ok: false, error } with a specific message an organiser can act on.
 */
import { dateProblem, isHex, isReservedPageSlug, slugify, validSlug } from "./rules";
import type { EditionKind, OrgRole, SessionKind } from "./types";

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const trim = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const orNull = (s: string) => (s ? s : null);

/** https only, no whitespace or markup characters: mirrors the database CHECK. */
export const isHttpsUrl = (u: string) => /^https:\/\/[^\s\\<>"']+$/.test(u) && u.length <= 500;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (e: string) => EMAIL.test(e) && e.length <= 200;
const DANGEROUS_MARKUP = /<\s*(script|iframe|object|embed|style)/i;

function len(label: string, v: string, min: number, max: number): string | null {
  if (v.length < min) return min === 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`;
  if (v.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}
/**
 * An uploaded or linked image address. Always https. The ONE exception is a local review stack: when the configured Supabase address is itself loopback http, images
 * stored in that stack's own storage (its public `edition-media` URLs) are accepted so uploads can be tested for real. In production the configured address is
 * https, so this can never widen anything there.
 */
export function isMediaUrl(v: string): boolean {
  if (isHttpsUrl(v)) return true;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) return false;
  return v.startsWith(`${base}/storage/v1/object/public/edition-media/`) && /^[^\s<>"']+$/.test(v);
}
function optUrl(label: string, v: string): string | null {
  if (!v) return null;
  return isHttpsUrl(v) ? null : `${label} must be a full link starting with https://`;
}
function optMediaUrl(label: string, v: string): string | null {
  if (!v) return null;
  return isMediaUrl(v) ? null : `${label} must be a full link starting with https://`;
}

/* ── Organiser ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/** A cover photograph's focus point: "x% y%". Anything else is dropped (the database enforces the same shape). */
const focusOrNull = (v: unknown): string | null => { const t = trim(v); return /^(100|[0-9]{1,2})% (100|[0-9]{1,2})%$/.test(t) && t !== "50% 50%" ? t : null; };

export type OrganiserProfile = {
  name: string; tagline: string | null; description: string | null; logo_url: string | null; cover_url: string | null; cover_focus: string | null;
  brand_color: string | null; website: string | null; contact_email: string | null;
};
export function organiserProfile(i: Record<string, unknown>): Checked<OrganiserProfile> {
  const name = trim(i.name), tagline = trim(i.tagline), description = trim(i.description);
  const logo = trim(i.logo_url), cover = trim(i.cover_url), color = trim(i.brand_color), website = trim(i.website), email = trim(i.contact_email).toLowerCase();
  const e = len("Name", name, 2, 120) ?? len("Tagline", tagline, 0, 160) ?? len("Description", description, 0, 4000)
    ?? optMediaUrl("Logo", logo) ?? optMediaUrl("Cover image", cover) ?? optUrl("Website", website);
  if (e) return fail(e);
  if (color && !isHex(color)) return fail("Brand colour must look like #0b5a73.");
  if (email && !isEmail(email)) return fail("That contact email does not look right.");
  return { ok: true, value: { name, tagline: orNull(tagline), description: orNull(description), logo_url: orNull(logo), cover_url: orNull(cover), cover_focus: orNull(cover) ? focusOrNull(i.cover_focus) : null, brand_color: orNull(color), website: orNull(website), contact_email: orNull(email) } };
}


/* ── Team ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

export function inviteInput(i: { email?: unknown; role?: unknown }): Checked<{ email: string; role: "admin" | "editor" }> {
  const email = trim(i.email).toLowerCase();
  if (!isEmail(email)) return fail("Enter the email address they use for OneShetland.");
  if (i.role !== "admin" && i.role !== "editor") return fail("Choose Administrator or Editor.");
  return { ok: true, value: { email, role: i.role } };
}
export const isOrgRole = (r: unknown): r is OrgRole => r === "owner" || r === "admin" || r === "editor";

/* ── Editions ──────────────────────────────────────────────────────────────────────────────────────────────────── */

export const EDITION_KINDS: EditionKind[] = ["single_day", "multi_day", "week", "season", "campaign"];
export const isEditionKind = (k: unknown): k is EditionKind => EDITION_KINDS.includes(k as EditionKind);

export type EditionFields = {
  title: string; summary: string | null; description: string | null; kind: EditionKind; starts_on: string; ends_on: string; year_label: string | null;
  brand_color: string | null; logo_url: string | null; cover_url: string | null; cover_focus: string | null; series_id: string | null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export function editionFields(i: Record<string, unknown>): Checked<EditionFields> {
  const title = trim(i.title), summary = trim(i.summary), description = trim(i.description), year = trim(i.year_label);
  const color = trim(i.brand_color), logo = trim(i.logo_url), cover = trim(i.cover_url), seriesId = trim(i.series_id);
  const e = len("Title", title, 2, 140) ?? len("Summary", summary, 0, 300) ?? len("Description", description, 0, 8000) ?? len("Year label", year, 0, 20)
    ?? optMediaUrl("Logo", logo) ?? optMediaUrl("Cover image", cover);
  if (e) return fail(e);
  if (!isEditionKind(i.kind)) return fail("Choose what kind of Edition this is.");
  const dp = dateProblem(i.kind, trim(i.starts_on), trim(i.ends_on));
  if (dp) return fail(dp);
  if (color && !isHex(color)) return fail("Brand colour must look like #0b5a73.");
  if (seriesId && !isUuid(seriesId)) return fail("That series is not valid.");
  if (DANGEROUS_MARKUP.test(description)) return fail("Description cannot contain script or embed tags.");
  return { ok: true, value: { title, summary: orNull(summary), description: orNull(description), kind: i.kind, starts_on: trim(i.starts_on), ends_on: trim(i.ends_on), year_label: orNull(year), brand_color: orNull(color), logo_url: orNull(logo), cover_url: orNull(cover), cover_focus: orNull(cover) ? focusOrNull(i.cover_focus) : null, series_id: orNull(seriesId) } };
}

export function editionSlug(raw: unknown, fallbackTitle: string): Checked<string> {
  const slug = trim(raw).toLowerCase() || slugify(fallbackTitle);
  if (!validSlug(slug, 3, 80)) return fail("The web address needs 3 to 80 letters, numbers and single hyphens. It cannot be changed later.");
  return { ok: true, value: slug };
}
export function seriesName(raw: unknown): Checked<string> {
  const n = trim(raw);
  const e = len("Series name", n, 2, 120);
  return e ? fail(e) : { ok: true, value: n };
}

/** Suggested next-year dates: same span, shifted one year (used by "Create next year's Edition"). */
export function shiftYear(iso: string, years = 1): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) dt.setUTCDate(0); // 29 Feb -> 28 Feb
  return dt.toISOString().slice(0, 10);
}

/* ── Pages ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type PageFields = { slug: string; nav_label: string; title: string; body: string; position: number; in_nav: boolean; is_home: boolean };
export function pageFields(i: Record<string, unknown>): Checked<PageFields> {
  const title = trim(i.title), nav = trim(i.nav_label) || title.slice(0, 30), slug = (trim(i.slug) || slugify(title)).toLowerCase();
  const body = typeof i.body === "string" ? i.body.replace(/\r/g, "") : "";
  const e = len("Title", title, 1, 140) ?? len("Menu label", nav, 1, 30);
  if (e) return fail(e);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 60) return fail("The page address needs 2 to 60 letters, numbers and single hyphens.");
  if (isReservedPageSlug(slug)) return fail(`"${slug}" is used by a built-in section of the Edition. Choose another address.`);
  if (body.length > 20000) return fail(`The page text is ${body.length.toLocaleString()} characters; the limit is 20,000.`);
  if (DANGEROUS_MARKUP.test(body)) return fail("Page text cannot contain script, iframe, embed or style tags.");
  const position = Number.isFinite(Number(i.position)) ? Math.max(0, Math.min(1000, Math.trunc(Number(i.position)))) : 0;
  return { ok: true, value: { slug, nav_label: nav, title, body, position, in_nav: i.in_nav !== false, is_home: i.is_home === true } };
}

/* ── Venues ────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type VenueFields = { name: string; address: string | null; lat: number | null; lng: number | null; notes: string | null };
export function venueFields(i: Record<string, unknown>): Checked<VenueFields> {
  const name = trim(i.name), address = trim(i.address), notes = trim(i.notes), latS = trim(i.lat), lngS = trim(i.lng);
  const e = len("Venue name", name, 1, 120) ?? len("Address", address, 0, 300) ?? len("Notes", notes, 0, 500);
  if (e) return fail(e);
  let lat: number | null = null, lng: number | null = null;
  if (latS || lngS) {
    lat = Number(latS); lng = Number(lngS);
    if (!latS || !lngS || !Number.isFinite(lat) || !Number.isFinite(lng)) return fail("Give both latitude and longitude as numbers, or leave both empty.");
    if (lat < -90 || lat > 90) return fail("Latitude must be between -90 and 90.");
    if (lng < -180 || lng > 180) return fail("Longitude must be between -180 and 180.");
  }
  return { ok: true, value: { name, address: orNull(address), lat, lng, notes: orNull(notes) } };
}

/* ── Sessions ──────────────────────────────────────────────────────────────────────────────────────────────────── */

const TZ = "Europe/London";
const PARTS = (ms: number) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: g("year"), mo: g("month"), d: g("day"), h: g("hour"), mi: g("minute"), s: g("second") };
};
const offsetMs = (utcMs: number) => { const p = PARTS(utcMs); return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(utcMs / 1000) * 1000; };

/** "2027-05-01T14:30" typed as Europe/London wall-clock time -> UTC ISO string. null if malformed. */
export function londonLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (new Date(naive).getUTCMonth() !== +m[2] - 1) return null;
  let t = naive - offsetMs(naive);
  t = naive - offsetMs(t);
  return new Date(t).toISOString();
}
/** UTC ISO -> "YYYY-MM-DDTHH:mm" in Europe/London, for <input type="datetime-local">. */
export function isoToLondonLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const p = PARTS(ms), z = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${z(p.y, 4)}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}
export const londonDate = (iso: string) => isoToLondonLocal(iso).slice(0, 10);

/** Mirrors edition_sessions_window: the session's London date must be within the Edition dates, plus or minus one day. */
export function sessionOutsideEdition(startsAtIso: string, startsOn: string, endsOn: string): boolean {
  const d = londonDate(startsAtIso);
  return d < shiftDay(startsOn, -1) || d > shiftDay(endsOn, 1);
}
function shiftDay(iso: string, n: number): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export const SESSION_KINDS: SessionKind[] = ["event", "activity", "session", "exhibition", "tour"];
export type SessionFields = {
  title: string; description: string | null; starts_at: string; ends_at: string | null; venue_id: string | null; kind: SessionKind;
  ticket_mode: "none" | "external"; ticket_url: string | null; price_text: string | null; status: "scheduled" | "cancelled" | "changed"; position: number;
  image_url: string | null; presenters: string | null;
};
export function sessionFields(i: Record<string, unknown>, edition: { starts_on: string; ends_on: string }): Checked<SessionFields> {
  const title = trim(i.title), description = trim(i.description), price = trim(i.price_text), ticketUrl = trim(i.ticket_url), venue = trim(i.venue_id);
  const image = trim(i.image_url), presenters = trim(i.presenters);
  const e = len("Title", title, 1, 140) ?? len("Description", description, 0, 2000) ?? len("Price note", price, 0, 60) ?? len("Presenters", presenters, 0, 200) ?? optMediaUrl("Photograph", image);
  if (e) return fail(e);
  const startsAt = londonLocalToIso(trim(i.starts_local));
  if (!startsAt) return fail("Choose a start date and time.");
  let endsAt: string | null = null;
  if (trim(i.ends_local)) {
    endsAt = londonLocalToIso(trim(i.ends_local));
    if (!endsAt) return fail("The end time is not a valid date and time.");
    if (Date.parse(endsAt) <= Date.parse(startsAt)) return fail("The end must be after the start.");
  }
  if (sessionOutsideEdition(startsAt, edition.starts_on, edition.ends_on)) return fail(`That session falls outside the Edition's dates (${edition.starts_on} to ${edition.ends_on}).`);
  if (!SESSION_KINDS.includes(i.kind as SessionKind)) return fail("Choose what type of session this is.");
  const mode = i.ticket_mode === "external" ? "external" : "none";
  if (mode === "external") {
    if (!ticketUrl) return fail("Add a ticket link, or set tickets to none.");
    if (!isHttpsUrl(ticketUrl)) return fail("The ticket link must be a full link starting with https://");
  }
  if (venue && !isUuid(venue)) return fail("That venue is not valid.");
  const status = i.status === "cancelled" || i.status === "changed" ? i.status : "scheduled";
  const position = Number.isFinite(Number(i.position)) ? Math.max(0, Math.min(10000, Math.trunc(Number(i.position)))) : 0;
  return { ok: true, value: { title, description: orNull(description), starts_at: startsAt, ends_at: endsAt, venue_id: orNull(venue), kind: i.kind as SessionKind, ticket_mode: mode, ticket_url: mode === "external" ? ticketUrl : null, price_text: orNull(price), status, position, image_url: orNull(image), presenters: orNull(presenters) } };
}

/* ── Updates, sponsors ─────────────────────────────────────────────────────────────────────────────────────────── */

export type UpdateFields = { title: string; body: string; pinned: boolean; published_at: string | null; image_url: string | null };
/** `publish`: true = publish now (keeping an earlier published_at if it already had one), false = keep as draft. */
export function updateFields(i: Record<string, unknown>, existingPublishedAt: string | null, now = new Date()): Checked<UpdateFields> {
  const title = trim(i.title), body = typeof i.body === "string" ? i.body.replace(/\r/g, "").trim() : "";
  const image = trim(i.image_url);
  const e = len("Title", title, 1, 140) ?? len("Message", body, 0, 4000) ?? optMediaUrl("Photograph", image);
  if (e) return fail(e);
  if (DANGEROUS_MARKUP.test(body)) return fail("The message cannot contain script, iframe, embed or style tags.");
  const published_at = i.publish === true ? (existingPublishedAt ?? now.toISOString()) : null;
  return { ok: true, value: { title, body, pinned: i.pinned === true, published_at, image_url: orNull(image) } };
}

export type SponsorFields = { name: string; level: string | null; logo_url: string | null; url: string | null; position: number };
export function sponsorFields(i: Record<string, unknown>): Checked<SponsorFields> {
  const name = trim(i.name), level = trim(i.level), logo = trim(i.logo_url), url = trim(i.url);
  const e = len("Sponsor name", name, 1, 120) ?? len("Level", level, 0, 40) ?? optMediaUrl("Logo", logo) ?? optUrl("Website", url);
  if (e) return fail(e);
  const position = Number.isFinite(Number(i.position)) ? Math.max(0, Math.min(10000, Math.trunc(Number(i.position)))) : 0;
  return { ok: true, value: { name, level: orNull(level), logo_url: orNull(logo), url: orNull(url), position } };
}

/* ── Images ────────────────────────────────────────────────────────────────────────────────────────────────────── */

export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export function imageProblem(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES[file.type]) return "Use a JPEG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "That image is larger than 10 MB. Choose a smaller one.";
  if (file.size === 0) return "That file is empty.";
  return null;
}
/** The object path MUST start with the organiser id (the storage policy checks the first folder). */
export const mediaPath = (organiserId: string, kind: string, uuid: string, mime: string) =>
  `${organiserId}/${kind.replace(/[^a-z0-9-]/g, "")}/${uuid}.${IMAGE_TYPES[mime] ?? "jpg"}`;
