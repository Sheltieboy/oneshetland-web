/**
 * JSON-LD structured-data builders for the public detail pages. Each returns a
 * plain schema.org object; render it with <JsonLd data={…} />. Empty fields are
 * dropped so we never emit blank/invalid properties.
 */

import { displayOccurrences, nextOccurrence, type Occurrence } from "./event-occurrences";
import { eventOrganiser } from "./event-organiser";

const BASE = "https://oneshetland.com";

type Obj = Record<string, unknown>;

function clean(o: Obj): Obj {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)),
  );
}
const stripTags = (s: string | null | undefined): string => (s ? s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "");

/** A breadcrumb trail for any detail page. */
export function breadcrumbSchema(items: { name: string; path: string }[]): Obj {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${BASE}${it.path}` })),
  };
}

export function businessSchema(b: {
  id: string; slug: string | null; name: string; description: string | null; address: string | null;
  lat: number | null; lng: number | null; logo_url: string | null; cover_url: string | null;
  phone: string | null; website: string | null; email: string | null; category: string | null;
}): Obj {
  const url = `${BASE}/directory/${b.slug || b.id}`;
  return clean({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": url,
    name: b.name,
    description: stripTags(b.description) || undefined,
    url,
    image: b.cover_url || b.logo_url || undefined,
    logo: b.logo_url || undefined,
    telephone: b.phone || undefined,
    email: b.email || undefined,
    address: b.address ? { "@type": "PostalAddress", streetAddress: b.address, addressRegion: "Shetland", addressCountry: "GB" } : undefined,
    geo: b.lat != null && b.lng != null ? { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng } : undefined,
    sameAs: b.website ? [b.website] : undefined,
    areaServed: { "@type": "Place", name: "Shetland Islands, Scotland" },
  });
}

export function eventSchema(e: {
  id: string; title: string; description: string | null; starts_at: string; ends_at: string | null;
  venue: string | null; locality: string | null; formatted_address: string | null; cover_url: string | null;
  status: string; business: { name: string | null } | null; hub: { name: string | null } | null;
  /** Optional until the community-events columns exist in production; never selected today. */
  is_platform_event?: boolean | null; source?: string | null; organiser_name?: string | null;
  ticket_types: { name: string; price_pence: number; is_active: boolean }[];
}): Obj {
  const url = `${BASE}/whats-on/${e.id}`;
  const offers = (e.ticket_types || [])
    .filter((t) => t.is_active)
    .map((t) => ({ "@type": "Offer", name: t.name, price: (t.price_pence / 100).toFixed(2), priceCurrency: "GBP", url, availability: "https://schema.org/InStock" }));
  // Same business-then-hub order as before; a community event names its contributor, never OneShetland.
  const organizerName = eventOrganiser(e, { prefer: "business" })?.name ?? null;
  return clean({
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    startDate: e.starts_at,
    endDate: e.ends_at || undefined,
    description: stripTags(e.description) || undefined,
    image: e.cover_url || undefined,
    url,
    eventStatus:
      e.status === "cancelled" ? "https://schema.org/EventCancelled"
      : e.status === "postponed" ? "https://schema.org/EventPostponed"
      : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: e.venue || e.locality || "Shetland",
      address: e.formatted_address || e.locality || "Shetland, Scotland",
    },
    // A cancelled event offers nothing: no ticket "InStock" for something that is not happening.
    offers: offers.length && e.status !== "cancelled" ? offers : undefined,
    organizer: organizerName ? { "@type": "Organization", name: organizerName } : undefined,
  });
}

/**
 * A dated run (one production, several performances) as one parent Event with a subEvent per performance. NOT wired into any page yet.
 * With no occurrences it returns exactly what eventSchema returns, so an ordinary event is unchanged. Cancelled performances are listed
 * with EventCancelled (a visitor and a search engine should both see them as cancelled). Offers appear only when a real https ticket
 * link exists. The organiser is organiser_name when present, else the business or hub.
 */
export function eventRunSchema(
  e: Parameters<typeof eventSchema>[0] & { organiser_name?: string | null; ticket_url?: string | null },
  occurrences: readonly Occurrence[] | null | undefined,
  now: Date | number = new Date(),
): Obj {
  const occ = displayOccurrences(occurrences);
  if (occ.length === 0) return eventSchema(e);
  const url = `${BASE}/whats-on/${e.id}`;
  const status = (st: string | null | undefined) =>
    st === "cancelled" ? "https://schema.org/EventCancelled" : st === "postponed" ? "https://schema.org/EventPostponed" : "https://schema.org/EventScheduled";
  const place = (venue: string | null | undefined, locality: string | null | undefined) => ({
    "@type": "Place",
    name: venue || e.venue || locality || e.locality || "Shetland",
    address: (venue ? undefined : e.formatted_address) || locality || e.locality || "Shetland, Scotland",
  });
  const live = occ.filter((o) => o.status !== "cancelled");
  const allCancelled = live.length === 0;
  const first = nextOccurrence(live, now) ?? live[0] ?? occ[0];
  const last = occ[occ.length - 1];
  const ticket = typeof e.ticket_url === "string" && /^https:\/\//i.test(e.ticket_url.trim()) ? e.ticket_url.trim() : null;
  const offers = ticket
    ? (e.ticket_types || []).filter((t) => t.is_active).length
      ? e.ticket_types.filter((t) => t.is_active).map((t) => ({ "@type": "Offer", name: t.name, price: (t.price_pence / 100).toFixed(2), priceCurrency: "GBP", url: ticket, availability: "https://schema.org/InStock" }))
      : [{ "@type": "Offer", url: ticket }]
    : undefined;
  // Same single rule as the page (lib/event-organiser.ts): community -> its named group, then the owning business/hub, then an explicit
  // OneShetland marker, then a curated listing's organiser_name; a plain platform-owned event names no organizer.
  const organizerName = eventOrganiser(e, { prefer: "business" })?.name ?? null;
  return clean({
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    startDate: first.starts_at,
    endDate: last.ends_at || last.starts_at,
    description: stripTags(e.description) || undefined,
    image: e.cover_url || undefined,
    url,
    eventStatus: allCancelled ? "https://schema.org/EventCancelled" : status(e.status),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: place(e.venue, e.locality),
    subEvent: occ.map((o) =>
      clean({
        "@type": "Event",
        name: e.title,
        startDate: o.starts_at,
        endDate: o.ends_at || undefined,
        url,
        eventStatus: status(o.status === "cancelled" || e.status === "cancelled" ? "cancelled" : e.status === "postponed" ? "postponed" : "scheduled"),
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: place(o.venue, o.locality),
      }),
    ),
    offers: allCancelled || e.status === "cancelled" ? undefined : offers,   // nothing to buy for a cancelled event
    organizer: organizerName ? { "@type": "Organization", name: organizerName } : undefined,
  });
}

export function wordSchema(w: {
  id: number; slug?: string | null; word: string; short_meaning: string | null; spik_meaning: string | null; part_of_speech: string | null;
}): Obj {
  return clean({
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: w.word,
    description: stripTags(w.spik_meaning || w.short_meaning) || undefined,
    url: `${BASE}/spik/${w.slug || w.id}`,
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Spik — the Shetland dialect dictionary", url: `${BASE}/spik` },
  });
}

export function hubSchema(h: {
  id: string; name: string; description: string | null; logo_url: string | null;
  website: string | null; contact_email: string | null; contact_phone: string | null; area: string | null;
}): Obj {
  return clean({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: h.name,
    description: stripTags(h.description) || undefined,
    url: `${BASE}/hubs/${h.id}`,
    logo: h.logo_url || undefined,
    email: h.contact_email || undefined,
    telephone: h.contact_phone || undefined,
    sameAs: h.website ? [h.website] : undefined,
    areaServed: { "@type": "Place", name: h.area || "Shetland" },
  });
}

export function articleSchema(a: {
  slug: string; title: string; excerpt: string | null; hero_url: string | null;
  author: string; publish_at: string | null; updated_at: string;
}): Obj {
  const url = `${BASE}/almanac/${a.slug}`;
  return clean({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt || undefined,
    image: a.hero_url || undefined,
    url,
    datePublished: a.publish_at || undefined,
    dateModified: a.updated_at || undefined,
    author: { "@type": "Organization", name: a.author || "OneShetland", url: BASE },
    publisher: { "@id": `${BASE}/#org` },
    isPartOf: { "@type": "Blog", name: "The Shetland Almanac", url: `${BASE}/almanac` },
  });
}

/** Lightweight schema for a vessel (no exact schema.org type fits a fishing boat). */
export function vesselSchema(v: { id: string; name: string; description: string; image: string | null }): Obj {
  return clean({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: v.name,
    description: stripTags(v.description) || undefined,
    url: `${BASE}/boats/${v.id}`,
    image: v.image || undefined,
    about: "Shetland fishing vessel",
  });
}
