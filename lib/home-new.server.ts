/**
 * lib/home-new.server.ts — the REAL candidates for "New in Shetland this week" (anonymous reads only, so a test fixture or hidden row can never
 * appear: the database withholds them). Each source supplies its genuine publication moment, never a bare created_at where the two differ:
 *
 *   events      calendar_approved_at (a hub event added to the calendar), else created_at (a published event); must not have ended
 *   activities  calendar_approved_at, else created_at; must have a real upcoming session (taken from the homepage activity listing)
 *   jobs        listed_at (the source's own publication date, else posted_at); must be open, visible and not expired
 *   offers      the later of created_at and valid_from (when it actually became visible); must be active, started and not ended
 *   businesses  owner_activated_at (an approved claim or a business created by its owner); same eligibility as Recently joined
 *
 * The pure rules (7-day window, expiry, shelf exclusion, variety, quiet weeks) are in lib/home-new-this-week.ts and are applied by the caller.
 * IMAGES are honest: an event with no cover uses the site's standard event image (as the What's happening mosaic does); a job, offer, business or activity with
 * no picture of its own shows a plain category-colour card, never a stock photo that could misrepresent it.
 * Every source fails to [] on its own, so one slow table cannot blank the section or slow the page.
 */
import { publicClient } from "./supabase/public.ts";
import { resilient } from "./home-resilience.ts";
import { WINDOW_DAYS, type NewItem } from "./home-new-this-week.ts";
import { getNewBusinessCandidates } from "./curated-businesses.ts";
import { HOME_FALLBACK_IMAGE } from "./event-display.ts";
import { safeImage } from "./home-announcements.ts";
import type { ListingRow } from "./activities.ts";
import { CATEGORY_LABEL } from "./local-data.ts";

const TZ = "Europe/London";
const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
const join = (...p: (string | null | undefined)[]) => p.filter((x) => x && String(x).trim()).join(" · ");
const later = (a: string, b: string | null) => (b && Date.parse(b) > Date.parse(a) ? b : a);
const HOUR = 3_600_000;

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function loadNewEvents(now: Date): Promise<NewItem[]> {
  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 24 * HOUR).toISOString();
  const { data, error } = await publicClient().from("events")
    .select("id, title, starts_at, ends_at, venue, locality, cover_url, created_at, calendar_approved_at, organiser_hub_id, calendar_approved")
    .eq("status", "published").eq("is_hidden", false)
    .or("organiser_hub_id.is.null,calendar_approved.eq.true")
    .or(`calendar_approved_at.gte.${cutoff},created_at.gte.${cutoff}`)
    .gte("starts_at", new Date(now.getTime() - 12 * HOUR).toISOString())
    .order("starts_at", { ascending: true }).limit(30);
  if (error) return [];
  return ((data ?? []) as Row[]).flatMap((e): NewItem[] => {
    const id = str(e.id), title = str(e.title), starts = str(e.starts_at);
    if (!id || !title || !starts) return [];
    const published = str(e.calendar_approved_at) ?? str(e.created_at);
    const ends = str(e.ends_at);
    return [{
      id, kind: "event", title, meta: join(dayLabel(starts), str(e.venue) ?? str(e.locality)), href: `/whats-on/${id}`,
      image: safeImage(e.cover_url) ?? HOME_FALLBACK_IMAGE, publishedAt: published, usefulUntil: ends ?? new Date(Date.parse(starts) + 3 * HOUR).toISOString(),
    }];
  });
}

export async function loadNewJobs(now: Date): Promise<NewItem[]> {
  const iso = now.toISOString();
  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 24 * HOUR).toISOString();
  const { data, error } = await publicClient().from("jobs")
    .select("id, title, locality, location, external_employer_name, listed_at, expires_at, biz:local_businesses!posted_as_business_id(name)")
    .eq("status", "open").eq("is_hidden", false)
    .or(`expires_at.is.null,expires_at.gt.${iso}`)
    .gte("listed_at", cutoff).order("listed_at", { ascending: false }).limit(20);
  if (error) return [];
  return ((data ?? []) as Row[]).flatMap((j): NewItem[] => {
    const id = str(j.id), title = str(j.title);
    if (!id || !title) return [];
    const biz = (Array.isArray(j.biz) ? (j.biz as Row[])[0] : j.biz) as Row | null;
    const closes = str(j.expires_at);
    return [{
      id, kind: "job", title, href: `/jobs/${id}`, image: null, publishedAt: str(j.listed_at), usefulUntil: closes,
      meta: join(str(biz?.name) ?? str(j.external_employer_name), str(j.locality) ?? str(j.location), closes ? `closes ${dayLabel(closes)}` : null),
    }];
  });
}

export async function loadNewOffers(now: Date): Promise<NewItem[]> {
  const iso = now.toISOString();
  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 24 * HOUR).toISOString();
  const sb = publicClient();
  const { data, error } = await sb.from("local_offers")
    .select("id, title, image_url, valid_from, valid_until, created_at, business_id")
    .eq("is_active", true).lte("valid_from", iso).gte("valid_until", iso)
    .or(`created_at.gte.${cutoff},valid_from.gte.${cutoff}`).order("created_at", { ascending: false }).limit(20);
  if (error || !data?.length) return [];
  const offers = data as Row[];
  const ids = [...new Set(offers.map((o) => str(o.business_id)).filter((x): x is string => !!x))];
  const { data: biz } = await sb.from("local_businesses").select("id, name, is_active").in("id", ids);
  const names = new Map(((biz ?? []) as Row[]).filter((b) => b.is_active === true).map((b) => [String(b.id), str(b.name)]));
  return offers.flatMap((o): NewItem[] => {
    const id = str(o.id), title = str(o.title), bid = str(o.business_id);
    if (!id || !title || !bid || !names.has(bid)) return [];   // an offer whose business is inactive or unreadable is not shown
    const until = str(o.valid_until);
    return [{
      id, kind: "offer", title, href: `/local#offers`, image: safeImage(o.image_url),
      publishedAt: later(String(o.created_at), str(o.valid_from)), usefulUntil: until,
      meta: join(names.get(bid), until ? `until ${dayLabel(until)}` : null),
    }];
  });
}

export async function loadNewBusinesses(now: Date): Promise<NewItem[]> {
  const rows = await getNewBusinessCandidates(WINDOW_DAYS, now);
  return rows.map((b) => ({
    id: b.id, kind: "business" as const, title: b.name, href: `/directory/${b.slug || b.id}`, image: safeImage(b.cover_url) ?? safeImage(b.logo_url),
    publishedAt: (b as { owner_activated_at?: string }).owner_activated_at ?? null, usefulUntil: null, meta: CATEGORY_LABEL[b.category ?? ""] ?? "Local business",
  }));
}

/** Activities added this week that have a real upcoming session, taken from the homepage activity listing (so the session is genuine). */
export async function loadNewActivities(now: Date, listing: readonly ListingRow[]): Promise<NewItem[]> {
  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 24 * HOUR).toISOString();
  const { data, error } = await publicClient().from("regular_activities")
    .select("id, slug, calendar_approved_at, created_at")
    .eq("status", "published").eq("admin_paused", false)
    .or(`calendar_approved_at.gte.${cutoff},created_at.gte.${cutoff}`).limit(30);
  if (error || !data?.length) return [];
  const byId = new Map(listing.map((r) => [r.id, r]));
  return (data as Row[]).flatMap((a): NewItem[] => {
    const row = byId.get(String(a.id));
    if (!row || !row.next_starts_at || Date.parse(row.next_starts_at) < now.getTime()) return [];
    return [{
      id: row.id, kind: "activity", title: row.title, href: `/whats-on/regular/${row.slug}`, image: safeImage(row.cover_url),
      publishedAt: str(a.calendar_approved_at) ?? str(a.created_at), usefulUntil: row.next_ends_at ?? row.next_starts_at,
      meta: join(`Next ${dayLabel(row.next_starts_at)}`, row.venue ?? row.locality),
    }];
  });
}

/** All sources in parallel, each failing to []. Cached briefly; the pure rules decide what is shown. */
export async function getHomeNewCandidates(listing: readonly ListingRow[] = [], now: Date = new Date()): Promise<NewItem[]> {
  return resilient<NewItem[]>("home:new", { ttlMs: 120_000, staleMs: 15 * 60_000, deadlineMs: 5000, fallback: [], isEmpty: () => false }, async () => {
    const safe = async (p: Promise<NewItem[]>) => { try { return await p; } catch { return []; } };
    const parts = await Promise.all([safe(loadNewEvents(now)), safe(loadNewJobs(now)), safe(loadNewOffers(now)), safe(loadNewBusinesses(now)), safe(loadNewActivities(now, listing))]);
    return parts.flat();
  });
}
