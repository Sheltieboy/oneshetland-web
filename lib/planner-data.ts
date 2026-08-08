import { publicClient } from "@/lib/supabase/public";
import { findPlace, needsFerry } from "@/lib/shetland-places";
import type { Candidate, Interest } from "@/lib/planner";

/**
 * Gathering what a day COULD be made of. The scheduling itself is in
 * lib/planner.ts — this only finds and shapes the raw candidates.
 */

const TIER_RANK: Record<string, number> = { premium: 2, pro: 1, free: 0 };

/** Which interests a business category speaks to. */
function interestsForCategory(category: string | null, tags: string[] | null): Interest[] {
  const out = new Set<Interest>();
  switch (category) {
    case "food_drink": out.add("food"); break;
    case "retail":     out.add("shops"); break;
    case "tourism":    out.add("history"); out.add("outdoors"); break;
    default: break;
  }
  for (const raw of tags ?? []) {
    const t = raw.toLowerCase();
    if (/coffee|caf|food|eat|bakery|restaurant|bar|pub/.test(t)) out.add("food");
    if (/knit|wool|craft|art|gift|shop|maker/.test(t)) out.add("shops");
    if (/museum|heritage|history|broch|archae/.test(t)) out.add("history");
    if (/walk|outdoor|wildlife|boat trip|beach|kayak/.test(t)) out.add("outdoors");
    if (/family|kids|bairn|play/.test(t)) out.add("family");
    if (/music|gig|live/.test(t)) out.add("music");
  }
  return [...out];
}

/** Which interests an event category speaks to. */
function interestsForEvent(category: string | null): Interest[] {
  const c = (category ?? "").toLowerCase();
  const out = new Set<Interest>();
  if (/music|gig|comedy|theatre|festival|dance/.test(c)) out.add("music");
  if (/heritage|culture|history|art|exhibition|craft/.test(c)) out.add("history");
  if (/food|drink|market/.test(c)) out.add("food");
  if (/sport|outdoor|walk/.test(c)) out.add("outdoors");
  if (/family|children|community/.test(c)) out.add("family");
  if (out.size === 0) out.add("music"); // "something on" is closest to events
  return [...out];
}

/** Businesses that make sense as a stop, with coordinates. */
async function fetchPlaces(): Promise<Candidate[]> {
  const sb = publicClient();
  const { data } = await sb
    .from("local_businesses")
    .select("id, name, slug, category, description, logo_url, cover_url, lat, lng, opening_hours, tags, subscription_tier, planner_visitor_ready, planner_dwell_minutes, planner_setting, planner_good_for, planner_booking, planner_note")
    .eq("is_active", true)
    .in("category", ["food_drink", "retail", "tourism"])
    .not("lat", "is", null)
    .not("lng", "is", null)
    .limit(300);

  return ((data ?? []) as Record<string, unknown>[])
    .map((b) => ({
      id: `biz:${b.id}`,
      kind: "place" as const,
      name: b.name as string,
      blurb: (b.description as string | null) ?? null,
      lat: Number(b.lat),
      lng: Number(b.lng),
      href: `/directory/${(b.slug as string) || b.id}`,
      image: (b.cover_url as string | null) ?? (b.logo_url as string | null) ?? null,
      hours: (b.opening_hours as Candidate["hours"]) ?? null,
      category: (b.category as string | null) ?? null,
      interests: interestsForCategory(b.category as string | null, b.tags as string[] | null),
      tierRank: TIER_RANK[(b.subscription_tier as string) ?? "free"] ?? 0,
      visitorReady: (b.planner_visitor_ready as boolean | null) ?? null,
      dwell: (b.planner_dwell_minutes as number | null) ?? null,
      setting: (b.planner_setting as Candidate["setting"]) ?? null,
      goodFor: (b.planner_good_for as string[] | null) ?? null,
      booking: (b.planner_booking as Candidate["booking"]) ?? null,
      note: (b.planner_note as string | null) ?? null,
    }))
    // A place with no coordinates can't be routed to, and one on a ferry
    // island can't be reached without a timetable we don't hold. The ferry
    // check was on events from the start and missing here, so the planner was
    // routing people to Yell and Unst and billing two crossings as a 97-minute
    // drive — while the page said ferry islands weren't planned for.
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && !needsFerry(c.lat, c.lng));
}

/** Published events inside the window, placed via the gazetteer. */
async function fetchEvents(fromIso: string, toIso: string): Promise<Candidate[]> {
  const sb = publicClient();
  const { data } = await sb
    .from("events")
    .select("id, title, description, venue, locality, category, starts_at, ends_at, cover_url, lat, lng")
    .eq("status", "published")
    .or("organiser_hub_id.is.null,calendar_approved.eq.true")
    .gte("starts_at", fromIso)
    .lte("starts_at", toIso)
    .order("starts_at", { ascending: true })
    .limit(60);

  const out: Candidate[] = [];
  for (const e of (data ?? []) as Record<string, unknown>[]) {
    // Prefer real coordinates if an event ever gains them; otherwise place it
    // from its venue/locality text, and skip it entirely if we can't.
    //
    // Note the explicit null check: Number(null) is 0, not NaN, and 0 is
    // finite — so a plain Number() conversion silently placed every event at
    // (0, 0) off West Africa, a 6,700 km drive, and the planner then dropped
    // them all as "finishes after you leave".
    let lat = e.lat == null ? NaN : Number(e.lat);
    let lng = e.lng == null ? NaN : Number(e.lng);
    let mainland = true;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const place = findPlace(e.venue as string, e.locality as string, e.title as string);
      if (!place) continue;
      lat = place.lat; lng = place.lng; mainland = place.mainland;
    }
    if (!mainland) continue; // needs a ferry — see shetland-places.ts

    out.push({
      id: `event:${e.id}`,
      kind: "event",
      name: e.title as string,
      blurb: (e.description as string | null) ?? null,
      lat, lng,
      href: `/whats-on/${e.id}`,
      image: (e.cover_url as string | null) ?? null,
      startsAt: e.starts_at as string,
      endsAt: (e.ends_at as string | null) ?? undefined,
      interests: interestsForEvent(e.category as string | null),
    });
  }
  return out;
}

export async function getPlannerCandidates(fromIso: string, toIso: string): Promise<Candidate[]> {
  const [places, events] = await Promise.all([
    fetchPlaces().catch(() => [] as Candidate[]),
    fetchEvents(fromIso, toIso).catch(() => [] as Candidate[]),
  ]);
  return [...events, ...places];
}
