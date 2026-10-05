/**
 * Business Page V2 — which sections appear, in what order, and which actions the hero offers.
 *
 * Pure and deterministic. A section appears only when the business has content for it (no empty shells, nothing
 * invented); the hero comes first; the practical sections (hours, location, contact) always close the page; and the
 * middle follows the business's emphasis. An explicit `layout` from Admin overrides the middle order.
 *
 * LIVE MODE: `enforceLive` is the last line of defence. Whatever produced the model, a live model is stripped of
 * every example, suggestion and prepared-only block before it can be rendered.
 */
import type { BusinessPageModel, Emphasis, HeroVisual, HeroVisualKind, PageMode, SectionId } from "./types.ts";

/** Does the business have anything to show for each section? */
export function availability(m: BusinessPageModel): Record<SectionId, boolean> {
  const hasHours = !!m.hours.hours && Object.values(m.hours.hours).some((v) => !!v);
  const hasContact = !!(m.contact.phone || m.contact.website || m.contact.email);
  return {
    hours: hasHours,
    story: !!(m.story || m.about),
    shop: !!m.shop?.items.length,
    offers: m.offers.length > 0,
    book: !!m.book,
    experience: !!(m.experience || m.passes.length),
    rewards: !!m.rewards,
    events: m.events.length > 0,
    useful: m.useful.length > 0,
    location: !!(m.location.address || (m.location.lat != null && m.location.lng != null)),
    contact: hasContact,
  };
}

/** The business's emphasis if Admin set one; otherwise inferred from what it actually has. */
export function inferEmphasis(m: Pick<BusinessPageModel, "emphasis"> & { shop: unknown; book: unknown; experience: unknown; passes?: unknown[] }): Emphasis {
  if (m.emphasis) return m.emphasis;
  if (m.book && !m.shop) return "book_first";
  if (m.shop) return "shop_first";
  if (m.experience || m.passes?.length) return "experience_first";
  return "story_then_shop";
}

const MIDDLE: Record<Emphasis, SectionId[]> = {
  story_then_shop: ["story", "shop", "experience", "book", "offers", "rewards", "events", "useful"],
  shop_first: ["shop", "story", "experience", "book", "offers", "rewards", "events", "useful"],
  book_first: ["book", "story", "offers", "rewards", "shop", "experience", "events", "useful"],
  experience_first: ["experience", "shop", "story", "book", "offers", "rewards", "events", "useful"],
};
const CLOSING: SectionId[] = ["hours", "location", "contact"];

/** The sections to render after the hero, in order. */
export function planSections(m: BusinessPageModel): SectionId[] {
  const has = availability(m);
  const middleOrder = m.layout?.length
    ? [...m.layout.filter((s) => MIDDLE.story_then_shop.includes(s)), ...MIDDLE[inferEmphasis(m)]]
    : MIDDLE[inferEmphasis(m)];
  const seen = new Set<SectionId>();
  const out: SectionId[] = [];
  for (const id of [...middleOrder, ...CLOSING]) {
    if (seen.has(id) || !has[id]) continue;
    seen.add(id); out.push(id);
  }
  return out;
}

/* ── hero actions ─────────────────────────────────────────────────────── */

export interface HeroAction { id: "shop" | "book" | "offers" | "experience" | "directions" | "call" | "website"; label: string; href: string; external?: boolean }

/** At most this many buttons in the hero: one primary and a few secondary. */
export const MAX_HERO_ACTIONS = 4;

/**
 * Primary actions, from what the business can really do. A capability it doesn't have produces no button.
 * The order follows the page's emphasis, then the practical ones (directions, call, website).
 */
export function heroActions(m: BusinessPageModel): HeroAction[] {
  const has = availability(m);
  const lead: Record<Emphasis, HeroAction["id"][]> = {
    shop_first: ["shop", "book", "offers", "experience"], story_then_shop: ["shop", "experience", "book", "offers"],
    book_first: ["book", "shop", "offers", "experience"], experience_first: ["experience", "shop", "book", "offers"],
  };
  const all: Partial<Record<HeroAction["id"], HeroAction>> = {};
  if (has.shop) all.shop = { id: "shop", label: "Shop", href: "#shop" };
  if (has.book) all.book = { id: "book", label: m.book?.cta && m.book.cta.length <= 18 ? m.book.cta : "Book", href: "#book" };
  if (has.offers) all.offers = { id: "offers", label: "View offers", href: "#offers" };
  if (has.experience) all.experience = { id: "experience", label: "Experience", href: "#experience" };
  if (m.location.mapHref) all.directions = { id: "directions", label: "Directions", href: m.location.mapHref, external: true };
  if (m.contact.phone) all.call = { id: "call", label: "Call", href: `tel:${m.contact.phone}` };
  if (m.contact.website) all.website = { id: "website", label: "Website", href: m.contact.website, external: true };
  const order = [...lead[inferEmphasis(m)], "directions", "call", "website"] as HeroAction["id"][];
  return order.map((k) => all[k]).filter((a): a is HeroAction => !!a).slice(0, MAX_HERO_ACTIONS);
}

/* ── hero visual ──────────────────────────────────────────────────────── */

/**
 * What fills the hero.
 *
 * PREPARED: an explicit choice from Admin is honoured when the content exists; otherwise a photograph is preferred,
 * then a mosaic of product pictures, then the branded card.
 *
 * LIVE (truthful): a genuine photograph carries a photographic hero; else three or more REAL product pictures make a
 * mosaic; otherwise the hero is COMPACT — a content-driven editorial header. A live page never gets the branded
 * card or any decorative panel standing in for a picture.
 */
export function chooseHeroVisual(want: HeroVisualKind | undefined, hasImage: boolean, collageCount: number, mode: PageMode = "prepared"): HeroVisual {
  if (mode === "live") return hasImage ? "photo" : collageCount >= 3 ? "mosaic" : "compact";
  if (want === "brand") return "brand";
  if (want === "mosaic" && collageCount >= 3) return "mosaic";
  if (want === "photo" && hasImage) return "photo";
  if (hasImage) return "photo";
  if (collageCount >= 3) return "mosaic";
  return "brand";
}

/* ── live mode ────────────────────────────────────────────────────────── */

/**
 * The guarantee behind the customer-facing page: remove EVERYTHING that is an example, a suggestion or a prepared
 * possibility. Idempotent; a no-op for a prepared model.
 */
export function enforceLive(m: BusinessPageModel): BusinessPageModel {
  if (m.mode !== "live") return m;
  const items = (m.shop?.items ?? []).filter((i) => !i.example);
  return {
    ...m,
    layout: undefined,
    hero: { ...m.hero, visual: m.hero.visual === "brand" ? "compact" : m.hero.visual, collage: m.hero.collage.slice(0, 3) },
    story: null, // a prepared story is not published content; the Directory description (about) is
    shop: items.length ? { ...m.shop!, items, example: false } : null,
    book: m.book && !m.book.example ? m.book : null,
    experience: null,
    rewards: m.rewards && !m.rewards.example ? m.rewards : null,
    useful: [],
  };
}
