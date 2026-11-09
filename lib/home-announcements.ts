/**
 * lib/home-announcements.ts — "Latest from OneShetland": the admin-managed announcements on the homepage.
 *
 * STORAGE. One table, public.home_announcements (migration 20270101000000). The database is the gatekeeper: the public can read ONLY rows that are
 * published, started and not expired; only an administrator can write; links and images are shape-checked by CHECK constraints. This file repeats
 * the same checks (defence in depth): a row that is somehow unsafe or malformed is dropped, never rendered.
 *
 * ORDER. `sort_order` ascending, then newest first. The FIRST live row is the featured story; the next live "Did you know?" and the next other row
 * fill the two supporting slots (see pickLatest).
 *
 * FAILURE. A failed or slow read means "no announcements": the section simply does not appear. It is never an error and never slows the page
 * (hard deadline, 60 s cache, and the last good copy is not held onto after a withdrawal: isEmpty is always false).
 */
import { publicClient } from "./supabase/public.ts";
import { resilient } from "./home-resilience.ts";
import { safePinHref } from "./home-pin.ts";

export type AnnouncementKind = "new" | "know";
export type AnnouncementVisual = "photo" | "save" | "activities" | "jobs" | "claim";
export type AnnouncementStatus = "draft" | "published" | "withdrawn";

export const KINDS: readonly AnnouncementKind[] = ["new", "know"];
export const VISUALS: readonly AnnouncementVisual[] = ["photo", "save", "activities", "jobs", "claim"];
export const STATUSES: readonly AnnouncementStatus[] = ["draft", "published", "withdrawn"];
export const ANNOUNCEMENT_LIMITS = { title: 60, body: 160, cta: 24 } as const;
export const VISUAL_LABEL: Record<AnnouncementVisual, string> = {
  photo: "A photograph", save: "My Saved screen", activities: "Regular activity page", jobs: "Job listings", claim: "Business checklist",
};
export const KIND_LABEL: Record<AnnouncementKind, string> = { new: "What's new", know: "Did you know?" };

export type Announcement = {
  id: string; kind: AnnouncementKind; title: string; body: string; cta: string; href: string; visual: AnnouncementVisual;
  image: string | null; status: AnnouncementStatus; starts: string | null; ends: string | null; sortOrder: number;
};

export type AnnouncementRow = {
  id?: unknown; kind?: unknown; title?: unknown; body?: unknown; cta_label?: unknown; href?: unknown; visual?: unknown; image_url?: unknown;
  status?: unknown; starts_at?: unknown; ends_at?: unknown; sort_order?: unknown;
};

export const ANNOUNCEMENT_COLUMNS = "id, kind, title, body, cta_label, href, visual, image_url, status, starts_at, ends_at, sort_order";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** A site path ("/x", not "//x") or an https address: the same rule as the pinned card and the database CHECK. Anything else is refused. */
export const safeHref = safePinHref;

/** An image: a site path or an https address (the database allows the same two shapes). */
export function safeImage(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 500 || /[\s\\<>"']/.test(s)) return null;
  if (/^\/(?!\/)/.test(s) || /^https:\/\/[^/]+/i.test(s)) return s;
  return null;
}

const isoOrNull = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** Defensive reader: a malformed or unsafe row becomes null (and is dropped), never an exception and never an unsafe link on the page. */
export function announcementFromRow(row: AnnouncementRow | null | undefined): Announcement | null {
  if (!row || typeof row.id !== "string" || !UUID.test(row.id)) return null;
  const kind = KINDS.find((k) => k === row.kind);
  const visual = VISUALS.find((v) => v === row.visual) ?? "photo";
  const status = STATUSES.find((s) => s === row.status);
  const title = clean(row.title, ANNOUNCEMENT_LIMITS.title);
  const cta = clean(row.cta_label, ANNOUNCEMENT_LIMITS.cta);
  const href = safeHref(row.href);
  if (!kind || !status || !title || !cta || !href) return null;
  return {
    id: row.id, kind, title, body: clean(row.body, 200), cta, href, visual, image: safeImage(row.image_url), status,
    starts: isoOrNull(row.starts_at), ends: isoOrNull(row.ends_at), sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
  };
}

/** Live right now: published, started (or no start) and not expired (or no end). The database applies the same rule to public reads. */
export function isLiveNow(a: Announcement, now: number = Date.now()): boolean {
  if (a.status !== "published") return false;
  if (a.starts && Date.parse(a.starts) > now) return false;
  if (a.ends && Date.parse(a.ends) <= now) return false;
  return true;
}

export type AnnouncementState = "live" | "scheduled" | "ended" | "draft" | "withdrawn";
/** What an administrator sees on a row: the publication status combined with the window. */
export function announcementState(a: Announcement, now: number = Date.now()): AnnouncementState {
  if (a.status === "draft") return "draft";
  if (a.status === "withdrawn") return "withdrawn";
  if (a.ends && Date.parse(a.ends) <= now) return "ended";
  if (a.starts && Date.parse(a.starts) > now) return "scheduled";
  return "live";
}

/** The featured story (first live), then one "Did you know?" and one other. Fewer live rows simply fill fewer slots. */
export function pickLatest(items: readonly Announcement[], now: number = Date.now()): { lead: Announcement | undefined; second: Announcement[] } {
  const live = items.filter((a) => isLiveNow(a, now)).sort((a, b) => a.sortOrder - b.sortOrder);
  const lead = live[0];
  const rest = live.filter((a) => a !== lead);
  const know = rest.find((a) => a.kind === "know");
  const other = rest.find((a) => a !== know && a.kind !== "know") ?? rest.find((a) => a !== know);
  return { lead, second: [know, other].filter((a): a is Announcement => !!a) };
}

export function readAnnouncements(rows: unknown): Announcement[] {
  return (Array.isArray(rows) ? (rows as AnnouncementRow[]) : []).map(announcementFromRow).filter((a): a is Announcement => !!a);
}

export const ANNOUNCEMENTS_DEADLINE_MS = 1500;

const defaultLoad = async (): Promise<Announcement[]> => {
  const { data, error } = await publicClient().from("home_announcements").select(ANNOUNCEMENT_COLUMNS)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(12);
  if (error) return [];
  return readAnnouncements(data).filter((a) => isLiveNow(a));
};

/** Live announcements for the homepage. Anonymous read, 60 s cache, 1.5 s deadline; failure means none. */
export async function getHomeAnnouncements(load: () => Promise<Announcement[]> = defaultLoad, deadlineMs: number = ANNOUNCEMENTS_DEADLINE_MS): Promise<Announcement[]> {
  return resilient<Announcement[]>("home:announcements", { ttlMs: 60_000, staleMs: 5 * 60_000, deadlineMs, fallback: [], isEmpty: () => false }, load);
}

/* ── Admin form helpers: a "YYYY-MM-DDTHH:mm" value in Shetland time <-> an ISO instant ─────────────────────────────────────────────────── */

function londonOffsetMs(utcMs: number): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(utcMs)).reduce<Record<string, number>>((a, x) => (x.type === "literal" ? a : { ...a, [x.type]: Number(x.value) }), {});
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-11-10T09:30" (as typed, Shetland time) -> the real instant. null for empty or invalid input. DST-safe (re-evaluates the offset at the result). */
export function londonLocalToIso(local: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(local ?? "").trim());
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = asUtc - londonOffsetMs(asUtc);
  t = asUtc - londonOffsetMs(t);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** An instant -> "YYYY-MM-DDTHH:mm" in Shetland time, for a datetime-local input. */
export function isoToLondonLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(t)).reduce<Record<string, string>>((a, x) => (x.type === "literal" ? a : { ...a, [x.type]: x.value }), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export type AnnouncementDraft = {
  kind: AnnouncementKind; title: string; body: string; cta: string; href: string; visual: AnnouncementVisual; image: string; status: AnnouncementStatus; startsLocal: string; endsLocal: string;
};

/** The first problem with a draft, in plain English, or null when it can be saved. The database enforces the same rules. */
export function validateAnnouncementDraft(d: AnnouncementDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.title.trim()) e.title = "Add a headline.";
  else if (d.title.trim().length > ANNOUNCEMENT_LIMITS.title) e.title = `Keep the headline to ${ANNOUNCEMENT_LIMITS.title} characters.`;
  if (d.body.length > ANNOUNCEMENT_LIMITS.body) e.body = `Keep the text to ${ANNOUNCEMENT_LIMITS.body} characters.`;
  if (!d.cta.trim()) e.cta = "Say what the link does, for example “Open My Saved”.";
  else if (d.cta.trim().length > ANNOUNCEMENT_LIMITS.cta) e.cta = `Keep the link words to ${ANNOUNCEMENT_LIMITS.cta} characters.`;
  if (!safeHref(d.href)) e.href = "Use a page on this site (starting with /) or a full https:// address.";
  if (d.image.trim() && !safeImage(d.image)) e.image = "Use an uploaded image, a site path or a full https:// address.";
  if (d.startsLocal && !londonLocalToIso(d.startsLocal)) e.starts = "That start date is not valid.";
  if (d.endsLocal && !londonLocalToIso(d.endsLocal)) e.ends = "That end date is not valid.";
  const s = londonLocalToIso(d.startsLocal), en = londonLocalToIso(d.endsLocal);
  if (s && en && Date.parse(en) <= Date.parse(s)) e.ends = "The end must be after the start.";
  if (d.status === "published" && en && Date.parse(en) <= Date.now()) e.ends = "That end date has already passed, so it would never show. Choose a later one, or save it as a draft.";
  return e;
}

export const draftToRow = (d: AnnouncementDraft) => ({
  kind: d.kind, title: d.title.trim(), body: d.body.trim(), cta_label: d.cta.trim(), href: (safeHref(d.href) ?? "").trim(), visual: d.visual,
  image_url: safeImage(d.image), status: d.status, starts_at: londonLocalToIso(d.startsLocal), ends_at: londonLocalToIso(d.endsLocal),
});

export const draftFromAnnouncement = (a: Announcement): AnnouncementDraft => ({
  kind: a.kind, title: a.title, body: a.body, cta: a.cta, href: a.href, visual: a.visual, image: a.image ?? "", status: a.status, startsLocal: isoToLondonLocal(a.starts), endsLocal: isoToLondonLocal(a.ends),
});

export const blankDraft = (): AnnouncementDraft => ({ kind: "new", title: "", body: "", cta: "Find out more", href: "/", visual: "photo", image: "", status: "draft", startsLocal: "", endsLocal: "" });
