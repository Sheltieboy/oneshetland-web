/**
 * Business Page V2 — merge the business's FACTS with a prepared DRAFT into one page model.
 *
 * Pure: no database, no framework. Real content always wins (a real product replaces every example product); an
 * example is used only where the business has nothing real for that section, and is always marked `example: true`
 * so the page can label it. Nothing here is written anywhere.
 *
 * LIVE MODE uses only the PROFILE layer of the draft (profile.ts): hero, story, labels, place, information blocks,
 * order. All commerce in the draft is discarded before anything is built, so a live model's shop, booking, experience
 * and rewards come ONLY from real OneShetland data. (enforceLive then strips again, as defence in depth.)
 */
import type { BusinessPageModel, Emphasis, ModelItem, PageDraft, PageMode } from "./types.ts";
import { chooseHeroVisual, enforceLive } from "./sections.ts";
import { extractProfile, profileAsDraft } from "./profile.ts";
import { accentOf, catColorFor, shorten, tagline } from "./tokens.ts";

type Hours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string>>;

export interface BuildInput {
  mode: PageMode;
  business: {
    id: string; name: string; category: string | null; description: string | null; address: string | null; lat: number | null; lng: number | null;
    logo_url: string | null; cover_url: string | null; brand_color: string | null; phone: string | null; website: string | null; email: string | null;
    opening_hours: Hours | null; opening_hours_until: string | null; is_verified: boolean; is_claimed: boolean; accepts_bookings: boolean;
  } | null;
  /** Used when the Directory record cannot be read (or is not public). */
  fallback: { id: string; name: string; locality?: string | null; description?: string | null; categoryLabel?: string | null; category?: string | null };
  categoryLabels: Record<string, string>;
  products: { id: string; title: string; price_pence: number; photos: string[] | null }[];
  offers: { id: string; title: string; description: string | null; image_url: string | null }[];
  passes: { id: string; name: string; description: string | null; price_pence: number | null; image_url: string | null }[];
  services: { id: string; name: string; description: string | null; duration_minutes: number | null; price_pence: number | null }[];
  loyalty: { type: string; stamps_required: number | null; stamp_reward: string | null; points_per_pound: number | null; points_for_pound: number | null } | null;
  events: { id: string; title: string; starts_at: string; venue: string | null }[];
  draft: PageDraft | null;
}

const loyaltyText = (l: NonNullable<BuildInput["loyalty"]>): string =>
  l.type === "points"
    ? `${l.points_per_pound ?? 1} point${l.points_per_pound === 1 ? "" : "s"} per £1 spent${l.points_for_pound ? ` · ${l.points_for_pound} points = £1 back` : ""}.`
    : `Collect ${l.stamps_required ?? 0} stamps${l.stamp_reward ? ` for ${l.stamp_reward}` : ""}.`;

const localityOf = (address: string | null, fallback?: string | null): string | null =>
  fallback ?? (address ? address.split(",").map((s) => s.trim()).filter(Boolean).slice(-1)[0] ?? null : null);

export function buildBusinessPageModel(i: BuildInput): BusinessPageModel {
  const b = i.business;
  const d = i.mode === "live" && i.draft ? profileAsDraft(extractProfile(i.draft)) : i.draft;
  const catKey = b?.category ?? i.fallback.category ?? null;
  const name = b?.name ?? i.fallback.name;
  const description = b?.description ?? i.fallback.description ?? null;

  const realItems: ModelItem[] = i.products.map((p) => ({ id: p.id, title: p.title, pricePounds: p.price_pence / 100, image: p.photos?.[0] ?? null, href: `/product/${p.id}`, example: false }));
  const exampleItems: ModelItem[] = (d?.products ?? []).map((p) => ({ id: p.id, title: p.title, pricePounds: p.price, image: p.image, blurb: p.blurb, example: true }));
  const items = realItems.length ? realItems : exampleItems;

  const realBook = i.business?.accepts_bookings && i.services.length > 0;
  const heroImage = d?.hero.image ?? (b?.cover_url ? { src: b.cover_url, alt: `${name}` } : null);
  // Prepared: product pictures, examples included (as before). Live: real products' pictures, else the draft's
  // price-less gallery — profile imagery, which carries no commerce claim.
  const realWithImage = realItems.filter((p) => !!p.image).slice(0, 3).map((p) => ({ src: p.image as string, alt: p.title, price: p.pricePounds }));
  const collage = i.mode === "live"
    ? (realWithImage.length ? realWithImage : (d?.hero.gallery ?? []).slice(0, 3).map((g) => ({ src: g.src, alt: g.alt })))
    : items.filter((p) => !!p.image).slice(0, 3).map((p) => ({ src: p.image as string, alt: p.title, price: p.pricePounds, example: p.example }));
  const emphasis: Emphasis | undefined = d?.emphasis;

  const model: BusinessPageModel = {
    mode: i.mode,
    emphasis: emphasis as Emphasis,
    layout: d?.layout,
    identity: {
      id: b?.id ?? i.fallback.id, name, categoryLabel: d?.hero.eyebrow?.trim() || (catKey ? i.categoryLabels[catKey] ?? i.fallback.categoryLabel ?? null : i.fallback.categoryLabel ?? null), categoryKey: catKey,
      locality: d?.hero.locality?.trim() || localityOf(b?.address ?? null, i.fallback.locality), address: b?.address ?? null, verified: !!b?.is_verified, claimed: !!b?.is_claimed,
      logo: b?.logo_url ?? null, accent: accentOf(b?.brand_color, catColorFor(catKey)),
    },
    hero: {
      headline: d?.hero.headline?.trim() || name,
      tagline: d?.hero.tagline?.trim() || (description ? tagline(description) : null),
      image: heroImage,
      visual: chooseHeroVisual(d?.hero.treatment, !!heroImage, collage.length),
      collage,
    },
    story: d?.story ? { eyebrow: d.story.eyebrow ?? "Our story", title: d.story.title, body: d.story.body, source: d.story.source } : null,
    about: description ? shorten(description, 600) : null,
    shop: items.length ? { title: realItems.length ? "Shop" : d?.productsTitle ?? "Shop", items, example: realItems.length === 0 } : null,
    offers: i.offers.map((o) => ({ id: o.id, title: o.title, description: o.description, image: o.image_url })),
    book: realBook
      ? { example: false, cta: "Book online", line: "Reserve a slot directly.", services: i.services.map((s) => ({ id: s.id, name: s.name, description: s.description, durationMinutes: s.duration_minutes, pricePence: s.price_pence })) }
      : d?.booking ? { example: true, cta: d.booking.cta, line: d.booking.line, services: [] } : null,
    passes: i.passes.map((p) => ({ id: p.id, name: p.name, description: p.description, pricePence: p.price_pence, image: p.image_url })),
    experience: d?.experience ? { ...d.experience, example: true } : null,
    rewards: i.loyalty ? { example: false, title: "Loyalty rewards", body: loyaltyText(i.loyalty) } : d?.rewards ? { example: true, ...d.rewards } : null,
    events: i.events.map((e) => ({ id: e.id, title: e.title, startsAt: e.starts_at, venue: e.venue })),
    useful: d?.useful ?? [],
    location: {
      address: b?.address ?? null, lat: b?.lat ?? null, lng: b?.lng ?? null,
      mapHref: b?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${b.address}`)}` : null,
    },
    contact: { phone: b?.phone ?? null, website: b?.website ?? null, email: b?.email ?? null },
    hours: { hours: b?.opening_hours ?? null, until: b?.opening_hours_until ?? null },
  };
  return enforceLive(model);
}
