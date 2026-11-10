/**
 * Search metadata and JSON-LD for the public Editions pages. Pure: no I/O. Empty fields are dropped (same clean-field pattern as lib/seo-schema.ts)
 * so we never emit blank or invalid properties. Only type imports from data.server, so this file is safe to load anywhere.
 */
import type { Metadata } from "next";
import type { PublicEditionBundle } from "./data.server";
import type { Edition, EditionVenue, Organiser } from "./types";

export const BASE = "https://oneshetland.com";
type Obj = Record<string, unknown>;

const clean = (o: Obj): Obj =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)));
export const stripMarkup = (s: string | null | undefined): string =>
  s ? s.replace(/<[^>]*>/g, "").replace(/[*_#>`]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim() : "";
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

export const editionPath = (slug: string, sub?: string) => `/editions/${slug}${sub ? `/${sub}` : ""}`;
/** Only a published, non-test Edition is indexable; a member's preview of anything else is noindex. */
export const isIndexable = (e: Pick<Edition, "status" | "is_test">) => e.status === "published" && !e.is_test;

export function editionDescription(e: Pick<Edition, "summary" | "description" | "title">, org?: Pick<Organiser, "name"> | null): string {
  const base = stripMarkup(e.summary) || stripMarkup(e.description);
  return clip(base || `${e.title}${org ? `, organised by ${org.name}` : ""}.`, 200);
}

/** generateMetadata helper shared by every Edition page. */
export function editionMetadata(b: Pick<PublicEditionBundle, "edition" | "organiser">, opts: { title?: string; sub?: string; description?: string; image?: string | null }): Metadata {
  const { edition, organiser } = b;
  const path = editionPath(edition.slug, opts.sub);
  const title = opts.title ? `${opts.title} · ${edition.title}` : edition.title;
  const description = opts.description ?? editionDescription(edition, organiser);
  return {
    title, description,
    alternates: { canonical: path },
    robots: isIndexable(edition) ? undefined : { index: false, follow: false },
    openGraph: { title, description, url: path, siteName: "OneShetland", type: "website", ...(opts.image ? { images: [{ url: opts.image }] } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(opts.image ? { images: [opts.image] } : {}) },
  };
}

const mapsUrl = (v: Pick<EditionVenue, "lat" | "lng">) =>
  typeof v.lat === "number" && typeof v.lng === "number" ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}` : null;
export { mapsUrl };

const place = (v: EditionVenue): Obj =>
  clean({
    "@type": "Place", name: v.name,
    address: v.address ? { "@type": "PostalAddress", streetAddress: v.address, addressRegion: "Shetland", addressCountry: "GB" } : undefined,
    geo: typeof v.lat === "number" && typeof v.lng === "number" ? { "@type": "GeoCoordinates", latitude: v.lat, longitude: v.lng } : undefined,
  });
const SHETLAND = { "@type": "Place", name: "Shetland Islands, Scotland" };

const STATUS_URL = { scheduled: "https://schema.org/EventScheduled", changed: "https://schema.org/EventRescheduled", cancelled: "https://schema.org/EventCancelled" } as const;

/** schema.org Event (EventSeries for seasons and campaigns) with the programme as subEvents. */
export function editionSchema(b: Pick<PublicEditionBundle, "edition" | "organiser" | "sessions" | "venues">): Obj {
  const { edition: e, organiser: o, sessions, venues } = b;
  const url = `${BASE}${editionPath(e.slug)}`;
  const venueById = new Map(venues.map((v) => [v.id, v]));
  const places = venues.map(place);
  return clean({
    "@context": "https://schema.org",
    "@type": e.kind === "season" || e.kind === "campaign" ? "EventSeries" : "Event",
    "@id": url, name: e.title, url,
    description: editionDescription(e, o),
    startDate: e.starts_on, endDate: e.ends_on,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: e.cover_url || e.logo_url || undefined,
    location: places.length === 1 ? places[0] : places.length > 1 ? places : SHETLAND,
    organizer: clean({ "@type": "Organization", name: o.name, url: `${BASE}/organisers/${o.slug}`, logo: o.logo_url || undefined }),
    subEvent: sessions.map((s) => {
      const v = s.venue_id ? venueById.get(s.venue_id) : undefined;
      return clean({
        "@type": "Event", name: s.title, description: stripMarkup(s.description) || undefined,
        startDate: s.starts_at, endDate: s.ends_at || undefined,
        eventStatus: STATUS_URL[s.status] ?? STATUS_URL.scheduled,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: v ? place(v) : undefined,
        offers: s.ticket_mode === "external" && s.ticket_url?.startsWith("https://") ? { "@type": "Offer", url: s.ticket_url } : undefined,
      });
    }),
  });
}

export function organiserSchema(o: Organiser, editions: Edition[]): Obj {
  const url = `${BASE}/organisers/${o.slug}`;
  return clean({
    "@context": "https://schema.org", "@type": "Organization", "@id": url, name: o.name, url,
    description: stripMarkup(o.description) || o.tagline || undefined,
    logo: o.logo_url || undefined,
    sameAs: o.website?.startsWith("https://") ? [o.website] : undefined,
    event: editions.map((e) => clean({ "@type": "Event", name: e.title, url: `${BASE}${editionPath(e.slug)}`, startDate: e.starts_on, endDate: e.ends_on })),
  });
}


/** schema.org Event for ONE programme item (a native session, or an independently owned event shown here: its canonical page is the offer/url). */
export function itemEventSchema(b: Pick<PublicEditionBundle, "edition" | "organiser">, item: {
  title: string; description?: string | null; starts_at: string; ends_at?: string | null; status: "scheduled" | "cancelled" | "changed"; image?: string | null;
  venue?: EditionVenue | null; locationText?: string | null; ticketUrl?: string | null; url: string; performers?: string[]; free?: boolean;
}): Obj {
  const { edition: e, organiser: o } = b;
  return clean({
    "@context": "https://schema.org", "@type": "Event", "@id": `${BASE}${item.url}`, name: item.title, url: `${BASE}${item.url}`,
    description: stripMarkup(item.description) || undefined,
    startDate: item.starts_at, endDate: item.ends_at || undefined,
    eventStatus: STATUS_URL[item.status] ?? STATUS_URL.scheduled,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: item.image || e.cover_url || undefined,
    location: item.venue ? place(item.venue) : item.locationText ? { "@type": "Place", name: item.locationText, address: { "@type": "PostalAddress", addressRegion: "Shetland", addressCountry: "GB" } } : SHETLAND,
    organizer: clean({ "@type": "Organization", name: o.name, url: `${BASE}/organisers/${o.slug}` }),
    superEvent: clean({ "@type": "Event", name: e.title, url: `${BASE}${editionPath(e.slug)}` }),
    performer: item.performers?.length ? item.performers.map((n) => ({ "@type": "Person", name: n })) : undefined,
    offers: item.ticketUrl?.startsWith("https://") ? { "@type": "Offer", url: item.ticketUrl } : undefined,
  });
}
