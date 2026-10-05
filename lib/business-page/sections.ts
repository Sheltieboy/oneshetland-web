/**
 * Business Page V2 — which sections appear, and in what order.
 *
 * ONE function, pure, deterministic. A section appears only when the business has content for it (no empty shells,
 * nothing invented); the hero is always first; the practical sections (hours, location, contact) always close the
 * page; and the middle follows the business's emphasis. An explicit `layout` from Admin overrides the middle order.
 */
import type { BusinessPageModel, Emphasis, SectionId } from "./types.ts";

/** Does the business have anything to show for each section? */
export function availability(m: BusinessPageModel): Record<SectionId, boolean> {
  const hasHours = !!m.hours.hours && Object.values(m.hours.hours).some((v) => !!v);
  const hasContact = !!(m.contact.phone || m.contact.website || m.contact.email);
  return {
    actions: !!(m.shop?.items.length || m.book || m.location.mapHref || m.contact.phone || m.contact.website),
    hours: hasHours,
    story: !!(m.story || m.about),
    shop: !!m.shop?.items.length,
    offers: m.offers.length > 0,
    book: !!m.book,
    experience: !!m.experience,
    rewards: !!m.rewards,
    events: m.events.length > 0,
    useful: m.useful.length > 0,
    location: !!(m.location.address || (m.location.lat != null && m.location.lng != null)),
    contact: hasContact,
  };
}

/** The business's emphasis if Admin set one; otherwise inferred from what it actually has. */
export function inferEmphasis(m: Pick<BusinessPageModel, "emphasis"> & { shop: unknown; book: unknown; experience: unknown }): Emphasis {
  if (m.emphasis) return m.emphasis;
  if (m.book && !m.shop) return "book_first";
  if (m.shop) return "shop_first";
  if (m.experience) return "experience_first";
  return "story_then_shop";
}

const MIDDLE: Record<Emphasis, SectionId[]> = {
  story_then_shop: ["story", "shop", "experience", "book", "offers", "rewards", "events", "useful"],
  shop_first: ["shop", "story", "experience", "book", "offers", "rewards", "events", "useful"],
  book_first: ["book", "story", "offers", "rewards", "shop", "experience", "events", "useful"],
  experience_first: ["experience", "shop", "story", "book", "offers", "rewards", "events", "useful"],
};
const OPENING: SectionId[] = ["actions"];
const CLOSING: SectionId[] = ["hours", "location", "contact"];

/** The sections to render after the hero, in order. */
export function planSections(m: BusinessPageModel): SectionId[] {
  const has = availability(m);
  const middleOrder = m.layout?.length
    ? [...m.layout.filter((s) => MIDDLE.story_then_shop.includes(s)), ...MIDDLE[inferEmphasis(m)]]
    : MIDDLE[inferEmphasis(m)];
  const seen = new Set<SectionId>();
  const out: SectionId[] = [];
  for (const id of [...OPENING, ...middleOrder, ...CLOSING]) {
    if (seen.has(id) || !has[id]) continue;
    seen.add(id); out.push(id);
  }
  return out;
}
