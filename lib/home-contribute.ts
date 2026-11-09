/**
 * lib/home-contribute.ts — the destinations and wording of the homepage contribution cards. EVERY link is an existing journey; nothing is invented:
 *   events    /whats-on/add          shown ONLY when the front door is on (EVENT_FRONT_DOOR === "on", lib/event-entry-points.ts), else not at all
 *   business  claim /business#find-your-business and add /directory/new (the same two journeys as JoinBusinessCta)
 *   work      /jobs/new and /shifts/new
 *   notices   /notices/post (signed-out visitors are sent to sign in by that page and brought back)
 *   offers    the owner's OWN offer manager, /business/<id>/manage/offers. Offers are a Pro-plan feature of a business page, so the card is shown only to a
 *             signed-in owner (the one person who can act on it) and sends them straight to their manager, where the page itself explains the plan.
 *             Everyone else already has the business card (claim or add) on the same page, so no second, near-identical invitation is shown.
 */
export const OWNER_OFFERS_HREF = (businessId: string) => `/business/${businessId}/manage/offers`;
export const OWNER_BUSINESSES_HREF = "/account";

export type OffersCard = { title: string; body: string; note: string; label: string; href: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function offersContribution(businesses: readonly { id: string; name?: string }[] | null | undefined): OffersCard {
  const mine = (businesses ?? []).filter((b) => b && UUID.test(b.id));
  if (mine.length === 0) return null;
  const base = {
    title: "Got an offer to share?",
    body: "A free coffee, a discount on a cake box, a bit off the haircut. Offers show on your listing and across Local.",
    note: "Offers are part of the Pro plan. Your business page shows what is included.",
  };
  if (mine.length === 1) return { ...base, label: "Post an offer", href: OWNER_OFFERS_HREF(mine[0].id) };
  return { ...base, label: "Choose your business", href: OWNER_BUSINESSES_HREF };
}
