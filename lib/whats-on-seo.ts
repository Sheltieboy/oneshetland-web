/**
 * whats-on-seo.ts — pure helpers for What's On metadata and the sitemap's visibility rules. No imports of data code.
 */
import { normaliseCategory } from "./event-categories";

const BASE = "https://oneshetland.com";

/** Plain-text description of about 155 characters: tags removed, whitespace collapsed, cut at a word with an ellipsis. */
export function trimDescription(raw: string | null | undefined, max = 155): string {
  const t = (raw ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

type EventMetaInput = { id: string; title: string; description?: string | null; venue?: string | null; locality?: string | null; cover_url?: string | null };
const FALLBACK_DESCRIPTION = "Find the date, time and place on OneShetland, the island guide to what's on across Shetland.";

/** Metadata for /whats-on/<id>. A missing, hidden or unreadable event gets a generic, non-indexed answer that reveals nothing. */
export function eventPageMetadata(id: string, e: EventMetaInput | null) {
  const path = `/whats-on/${id}`;
  if (!e) return { title: "Event", robots: { index: false, follow: false } };
  const where = [e.venue, e.locality].filter(Boolean).join(", ");
  const description = trimDescription(e.description) || (where ? `${e.title} at ${where}. ${FALLBACK_DESCRIPTION}` : `${e.title}. ${FALLBACK_DESCRIPTION}`);
  const cover = typeof e.cover_url === "string" && /^https:\/\//i.test(e.cover_url) ? e.cover_url : null;
  return {
    title: e.title,
    description,
    alternates: { canonical: `${BASE}${path}` },
    openGraph: { type: "article" as const, title: e.title, description, url: `${BASE}${path}`, siteName: "OneShetland", ...(cover ? { images: [{ url: cover }] } : {}) },
    twitter: { card: cover ? ("summary_large_image" as const) : ("summary" as const), title: e.title, description, ...(cover ? { images: [cover] } : {}) },
  };
}

/** Canonical for the What's On listing: every filter/view variant points at the base, or at the category page when a category is chosen. */
export function whatsOnCanonical(sp: { category?: string | string[] } | null | undefined): string {
  const raw = Array.isArray(sp?.category) ? sp?.category[0] : sp?.category;
  const c = normaliseCategory(raw);
  return c ? `${BASE}/whats-on?category=${encodeURIComponent(c)}` : `${BASE}/whats-on`;
}
export const REGULAR_CANONICAL = `${BASE}/whats-on/regular`;

/* ── Sitemap visibility (explicit, not RLS alone) ─────────────────────────────────────────────────────────────────────────── */

export type SitemapEventRow = { id: string; status?: unknown; is_hidden?: unknown; organiser_hub_id?: unknown; calendar_approved?: unknown; updated_at?: unknown };
/** Published, not hidden, and (if a hub's event) approved for the public calendar. */
export function eventIsListable(r: SitemapEventRow): boolean {
  return r.status === "published" && r.is_hidden !== true && r.is_hidden !== undefined && (!r.organiser_hub_id || r.calendar_approved === true);
}

export type SitemapActivityRow = {
  slug?: unknown; status?: unknown; admin_paused?: unknown; calendar_approved?: unknown;
  organiser_hub_id?: unknown; organiser_business_id?: unknown; is_platform_activity?: unknown; updated_at?: unknown;
};
/**
 * The activity_is_public rule, restated: published, not admin-paused, and its owner is live (a hub that is active and has approved it for
 * the calendar, or an active business, or a platform activity). Anything unknown fails closed. `activeHubs` / `activeBusinesses` hold ids
 * the caller READ as active; an id not in the set is treated as inactive.
 */
export function activityIsListable(a: SitemapActivityRow, activeHubs: ReadonlySet<string>, activeBusinesses: ReadonlySet<string>): boolean {
  if (typeof a.slug !== "string" || !a.slug) return false;
  if (a.status !== "published" || a.admin_paused !== false) return false;
  if (a.organiser_hub_id) return activeHubs.has(String(a.organiser_hub_id)) && a.calendar_approved === true;
  if (a.organiser_business_id) return activeBusinesses.has(String(a.organiser_business_id));
  return a.is_platform_activity === true;
}
