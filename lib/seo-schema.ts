/**
 * JSON-LD structured-data builders for the public detail pages. Each returns a
 * plain schema.org object; render it with <JsonLd data={…} />. Empty fields are
 * dropped so we never emit blank/invalid properties.
 */

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
  ticket_types: { name: string; price_pence: number; is_active: boolean }[];
}): Obj {
  const url = `${BASE}/whats-on/${e.id}`;
  const offers = (e.ticket_types || [])
    .filter((t) => t.is_active)
    .map((t) => ({ "@type": "Offer", name: t.name, price: (t.price_pence / 100).toFixed(2), priceCurrency: "GBP", url, availability: "https://schema.org/InStock" }));
  const organizerName = e.business?.name || e.hub?.name || null;
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
    offers: offers.length ? offers : undefined,
    organizer: organizerName ? { "@type": "Organization", name: organizerName } : undefined,
  });
}

export function wordSchema(w: {
  id: number; word: string; short_meaning: string | null; spik_meaning: string | null; part_of_speech: string | null;
}): Obj {
  return clean({
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: w.word,
    description: stripTags(w.spik_meaning || w.short_meaning) || undefined,
    url: `${BASE}/spik/${w.id}`,
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
