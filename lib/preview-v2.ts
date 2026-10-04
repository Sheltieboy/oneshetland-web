/**
 * preview-v2.ts — the design-validation previews of Home and Local (routes /preview/home-v2, /preview/local-v2).
 *
 * PREVIEW ONLY. Nothing here is wired into the live `/` or `/local`, and nothing here writes anywhere.
 *
 * The previews exist so the design can be judged with the page in four different states without touching real
 * inventory:
 *
 *   live   — what production would show right now (today: no genuine commerce)
 *   empty  — the pre-launch proposition state (zero commerce)
 *   seed   — the launch seed: a handful of items from a few partners
 *   full   — a populated marketplace (24 items a pillar)
 *
 * and for two viewers:
 *
 *   public — what the public sees: acceptance / ZZ / demo commerce is hidden
 *   admin  — Darren's QA view: those test items appear, each one visibly marked TEST / QA
 *
 * The seed and full states are INVENTED SAMPLE items (invented business names, brand photography), shown only so the
 * layout can be judged. The live state reads real data.
 */

import type { CSSProperties } from "react";

export type PreviewState = "live" | "empty" | "seed" | "full";
export type PreviewViewer = "public" | "admin";

export const STATES: { key: PreviewState; label: string; hint: string }[] = [
  { key: "live", label: "Live data", hint: "What production would show today" },
  { key: "empty", label: "Pre-launch", hint: "No commerce yet" },
  { key: "seed", label: "Launch seed", hint: "A few partners" },
  { key: "full", label: "Populated", hint: "A busy marketplace" },
];

export function parsePreview(sp: { state?: string; as?: string }): { state: PreviewState; viewer: PreviewViewer } {
  const state = (["live", "empty", "seed", "full"] as const).find((s) => s === sp.state) ?? "seed";
  const viewer = sp.as === "admin" ? "admin" : "public";
  return { state, viewer };
}

export type Pillar = "shop" | "offers" | "book" | "experiences";

export type Crop = { cx: number; cy: number; z: number };

export type Merch = {
  id: string;
  pillar: Pillar;
  title: string;
  business: string;
  /** "£185", "from £32" … already formatted. */
  price?: string;
  /** "10% off", "45 min", "1h 30m · 6 left" … */
  badge?: string;
  /** Extra line under the title: duration, valid-for, slot. */
  meta?: string;
  image?: string;
  crop?: Crop;
  href: string;
  /** Acceptance / demo commerce. Shown to the admin only, always visibly marked. */
  tag?: "TEST" | "QA";
  category?: string;
};

export const PILLARS: Record<Pillar, {
  label: string; short: string; color: string; deep: string; image: string; crop: Crop;
  tagline: string; emptyTitle: string; emptyBody: string; cta: { label: string; href: string }; seeAll: string; cats: string[];
}> = {
  shop: {
    label: "Shop", short: "Made here, bought from the maker", color: "#7c3aed", deep: "#4c1d95",
    image: "/preview-v2/shopping.jpg", crop: { cx: 0.5, cy: 0.5, z: 1 },
    tagline: "Knitwear, craft, food and drink from Shetland's own makers.",
    emptyTitle: "Shetland's makers are moving in",
    emptyBody: "Knitwear, gin, smoked salmon and silver — bought direct from the people who make it. The first shops open here soon.",
    cta: { label: "Sell on OneShetland", href: "/business" }, seeAll: "/shop",
    cats: ["Knitwear", "Food & drink", "Craft", "Art & prints", "Home", "Gifts"],
  },
  offers: {
    label: "Offers", short: "Local deals and rewards", color: "#d97706", deep: "#92400e",
    image: "/preview-v2/local-street.jpg", crop: { cx: 0.12, cy: 0.6, z: 1.9 },
    tagline: "Local deals worth walking in for.",
    emptyTitle: "Local deals are on their way",
    emptyBody: "Shops and cafés will post their offers here — a free coffee, a discount on a cake box, a bit off the haircut.",
    cta: { label: "Post an offer", href: "/business" }, seeAll: "/local#offers",
    cats: ["Food & drink", "Shops", "Services", "This week"],
  },
  book: {
    label: "Book", short: "Pick a service, pick a slot", color: "#059669", deep: "#064e3b",
    image: "/preview-v2/cafe.jpg", crop: { cx: 0.5, cy: 0.45, z: 1.1 },
    tagline: "Appointments and services, booked in a minute.",
    emptyTitle: "Booking is opening up",
    emptyBody: "Hair, beauty, therapies, repairs — see the free slots and book without the phone tag.",
    cta: { label: "Take bookings", href: "/business" }, seeAll: "/directory/bookable",
    cats: ["Hair & beauty", "Wellbeing", "Repairs", "Lessons"],
  },
  experiences: {
    label: "Experiences", short: "Passes and things to do", color: "#0e7490", deep: "#164e63",
    image: "/preview-v2/jarlshof.jpg", crop: { cx: 0.5, cy: 0.5, z: 1 },
    tagline: "Passes, tours and days out across the isles.",
    emptyTitle: "Days out, coming soon",
    emptyBody: "Guided walks, boat trips, workshops and multi-visit passes — buy once, use more than once.",
    cta: { label: "List an experience", href: "/business" }, seeAll: "/directory",
    cats: ["Heritage", "Wildlife", "Boat trips", "Workshops"],
  },
};

export const PILLAR_ORDER: Pillar[] = ["shop", "offers", "book", "experiences"];

/* ── Sample items ──────────────────────────────────────────────────────────── */

const SHOP_BASE: Omit<Merch, "id" | "pillar" | "href">[] = [
  { title: "Fair Isle yoke jumper", business: "Sample Knitwear Studio", price: "£185", image: "/preview-v2/shopping.jpg", crop: { cx: 0.24, cy: 0.2, z: 2.3 }, category: "Knitwear" },
  { title: "Shetland dry gin, 70cl", business: "Sample Distillery", price: "£38", image: "/preview-v2/shopping.jpg", crop: { cx: 0.44, cy: 0.38, z: 2.6 }, category: "Food & drink" },
  { title: "Hand-knitted mittens", business: "Sample Knitwear Studio", price: "£42", image: "/preview-v2/shopping.jpg", crop: { cx: 0.12, cy: 0.68, z: 2.4 }, category: "Knitwear" },
  { title: "Smoked salmon, whole side", business: "Sample Smokehouse", price: "£24", image: "/preview-v2/shopping.jpg", crop: { cx: 0.46, cy: 0.76, z: 2.4 }, category: "Food & drink" },
  { title: "Silver drop earrings", business: "Sample Silversmith", price: "£58", image: "/preview-v2/shopping.jpg", crop: { cx: 0.82, cy: 0.86, z: 2.8 }, category: "Gifts" },
  { title: "Blue cheese, 250g", business: "Sample Dairy", price: "£9", image: "/preview-v2/shopping.jpg", crop: { cx: 0.69, cy: 0.56, z: 2.6 }, category: "Food & drink" },
  { title: "Brown crab, dressed", business: "Sample Fishmonger", price: "£11", image: "/preview-v2/shopping.jpg", crop: { cx: 0.88, cy: 0.52, z: 2.4 }, category: "Food & drink" },
  { title: "Oatcakes, tin of 12", business: "Sample Bakehouse", price: "£6", image: "/preview-v2/shopping.jpg", crop: { cx: 0.16, cy: 0.9, z: 2.6 }, category: "Food & drink" },
  { title: "Wool, 4-ply skein", business: "Sample Spinners", price: "£14", image: "/preview-v2/shopping.jpg", crop: { cx: 0.08, cy: 0.3, z: 2.8 }, category: "Craft" },
  { title: "Mussels, 1kg net", business: "Sample Shellfish Co.", price: "£8", image: "/preview-v2/shopping.jpg", crop: { cx: 0.72, cy: 0.2, z: 2.4 }, category: "Food & drink" },
  { title: "Handmade pottery jug", business: "Sample Pottery", price: "£36", image: "/preview-v2/shopping.jpg", crop: { cx: 0.53, cy: 0.17, z: 2.9 }, category: "Home" },
  { title: "Lighthouse art print", business: "Sample Print Studio", price: "£22", image: "/preview-v2/lighthouse.jpg", crop: { cx: 0.5, cy: 0.5, z: 1.1 }, category: "Art & prints" },
];

const OFFER_BASE: Omit<Merch, "id" | "pillar" | "href">[] = [
  { title: "10% off any cake box", business: "Sample Bakehouse", badge: "10% off", meta: "Until 31 Oct", category: "Food & drink" },
  { title: "Free coffee with any pastry", business: "Sample Café", badge: "Free coffee", meta: "Weekdays before 11", category: "Food & drink" },
  { title: "Two-for-one on fish suppers", business: "Sample Chip Shop", badge: "2 for 1", meta: "Tuesdays", category: "Food & drink" },
  { title: "£5 off a cut & finish", business: "Sample Hair Studio", badge: "£5 off", meta: "New clients", category: "Services" },
  { title: "20% off knitting wool", business: "Sample Spinners", badge: "20% off", meta: "This week only", category: "Shops" },
  { title: "Free delivery in Lerwick", business: "Sample Grocer", badge: "Free delivery", meta: "Orders over £25", category: "Shops" },
  { title: "Kids eat free at weekends", business: "Sample Bistro", badge: "Kids free", meta: "Sat & Sun", category: "Food & drink" },
  { title: "Buy a mug, get a refill free", business: "Sample Roasters", badge: "Free refill", meta: "All month", category: "Food & drink" },
];

const BOOK_BASE: Omit<Merch, "id" | "pillar" | "href">[] = [
  { title: "Cut & finish", business: "Sample Hair Studio", price: "from £32", meta: "45 min", badge: "Next: Tue 10:30", category: "Hair & beauty" },
  { title: "Deep tissue massage", business: "Sample Therapies", price: "from £55", meta: "60 min", badge: "Next: Wed 14:00", category: "Wellbeing" },
  { title: "Bike service & safety check", business: "Sample Cycles", price: "from £45", meta: "90 min", badge: "Next: Thu 09:00", category: "Repairs" },
  { title: "Gel manicure", business: "Sample Beauty Room", price: "from £28", meta: "50 min", badge: "Next: Tue 16:15", category: "Hair & beauty" },
  { title: "Fiddle lesson, 1-to-1", business: "Sample Music Room", price: "£20", meta: "30 min", badge: "Next: Sat 11:00", category: "Lessons" },
  { title: "Boiler check", business: "Sample Heating", price: "from £70", meta: "60 min", badge: "Next: Mon 08:30", category: "Repairs" },
  { title: "Barber — skin fade", business: "Sample Barbers", price: "from £18", meta: "30 min", badge: "Next: Today 15:45", category: "Hair & beauty" },
  { title: "Reflexology", business: "Sample Therapies", price: "from £42", meta: "45 min", badge: "Next: Fri 12:00", category: "Wellbeing" },
];

const EXP_BASE: Omit<Merch, "id" | "pillar" | "href">[] = [
  { title: "Guided prehistoric site visit", business: "Sample Heritage Tours", price: "£12", meta: "2 hours · small groups", image: "/preview-v2/jarlshof.jpg", crop: { cx: 0.5, cy: 0.55, z: 1.15 }, category: "Heritage" },
  { title: "Lighthouse & headland tour", business: "Sample Coast Guides", price: "£9", meta: "90 minutes", image: "/preview-v2/lighthouse.jpg", crop: { cx: 0.62, cy: 0.5, z: 1.1 }, category: "Heritage" },
  { title: "Iron Age village day pass", business: "Sample Heritage Tours", price: "£10", meta: "5 visits · valid 12 months", image: "/preview-v2/scatness.jpg", crop: { cx: 0.5, cy: 0.5, z: 1.05 }, category: "Heritage" },
  { title: "Working harbour walk", business: "Sample Fishing Heritage", price: "£7", meta: "60 minutes", image: "/preview-v2/boats.jpg", crop: { cx: 0.55, cy: 0.55, z: 1.1 }, category: "Boat trips" },
  { title: "Peat & croft stories", business: "Sample Croft Museum", price: "£6", meta: "45 minutes", image: "/preview-v2/memory.jpg", crop: { cx: 0.5, cy: 0.5, z: 1.1 }, category: "Heritage" },
  { title: "Evening coastal wildlife cruise", business: "Sample Sea Trips", price: "£55", meta: "3 hours", image: "/preview-v2/cruise.jpg", crop: { cx: 0.5, cy: 0.5, z: 1.1 }, category: "Wildlife" },
];

/** Acceptance / demo commerce — what the admin sees for QA, always marked. */
const QA_ITEMS: Omit<Merch, "href">[] = [
  { id: "qa-print", pillar: "shop", title: "Hamnavoe Lighthouse Print", business: "ZZ TEST — Acceptance Fixture", price: "£1", tag: "QA", category: "Art & prints" },
  { id: "qa-demo-product", pillar: "shop", title: "DEMO — Launch Test Product", business: "Anderson & Co (demo seed)", price: "£1", tag: "TEST", category: "Gifts" },
  { id: "qa-booking", pillar: "book", title: "ZZ - Test booking", business: "ZZ TEST — Acceptance Fixture", price: "£1", meta: "30 min", badge: "QA slot", tag: "QA", category: "Repairs" },
  { id: "qa-wallet-pass", pillar: "experiences", title: "ZZ TEST — Wallet Pass", business: "ZZ TEST — Acceptance Fixture", price: "£1", meta: "1 use · valid 1 day", tag: "QA", category: "Heritage" },
  { id: "qa-demo-pass", pillar: "experiences", title: "ZZ - Demo Pass", business: "ZZ TEST — Acceptance Fixture", price: "£1", meta: "1 use · valid 10 days", tag: "QA", category: "Heritage" },
];

const BASES: Record<Pillar, Omit<Merch, "id" | "pillar" | "href">[]> = {
  shop: SHOP_BASE, offers: OFFER_BASE, book: BOOK_BASE, experiences: EXP_BASE,
};
const HREF: Record<Pillar, string> = { shop: "/shop", offers: "/local#offers", book: "/directory/bookable", experiences: "/directory" };
const COUNTS: Record<"seed" | "full", Record<Pillar, number>> = {
  seed: { shop: 3, offers: 2, book: 2, experiences: 3 },
  full: { shop: 24, offers: 22, book: 20, experiences: 21 },
};

function sample(pillar: Pillar, n: number): Merch[] {
  const base = BASES[pillar];
  return Array.from({ length: n }, (_, i) => {
    const b = base[i % base.length];
    const round = Math.floor(i / base.length);
    return { ...b, id: `${pillar}-${i}`, pillar, href: HREF[pillar], title: round ? `${b.title} — ${["small", "large", "gift set"][round % 3]}` : b.title };
  });
}

/** The commerce a preview state shows. `real` is the live inventory (used by the "live" state). */
export function buildCommerce(state: PreviewState, viewer: PreviewViewer, real: Record<Pillar, Merch[]>): Record<Pillar, Merch[]> {
  const base: Record<Pillar, Merch[]> =
    state === "live" ? real
      : state === "empty" ? { shop: [], offers: [], book: [], experiences: [] }
        : {
          shop: sample("shop", COUNTS[state].shop), offers: sample("offers", COUNTS[state].offers),
          book: sample("book", COUNTS[state].book), experiences: sample("experiences", COUNTS[state].experiences),
        };
  if (viewer !== "admin") return base;
  // Admin QA: the acceptance fixtures join, each marked. In "live" they are already present via the admin session in
  // production; in the sample states they are simulated here so the marking can be judged.
  const out = { ...base };
  for (const q of QA_ITEMS) {
    if (out[q.pillar].some((m) => m.id === q.id || (m.tag && m.title === q.title))) continue;
    out[q.pillar] = [{ ...q, href: HREF[q.pillar] }, ...out[q.pillar]];
  }
  return out;
}

/** Inventory band → how a pillar is presented. One rule for every surface. */
export type Density = "none" | "few" | "rail" | "many";
export function density(n: number): Density {
  return n === 0 ? "none" : n <= 3 ? "few" : n <= 12 ? "rail" : "many";
}

export const cropStyle = (c?: Crop): CSSProperties =>
  c ? { objectPosition: `${c.cx * 100}% ${c.cy * 100}%`, transform: `scale(${c.z})`, transformOrigin: `${c.cx * 100}% ${c.cy * 100}%` } : {};

/* ── The live state: real inventory, mapped into the same shape ─────────────── */

type LiveProduct = { id: string; title: string; price_pence: number; photo: string | null; business_name: string };
type LiveOffer = { id: string; title: string; valid_until: string; business: { id: string; name: string } | null };
type LivePass = { id: string; name: string; price_pence: number; image_url: string | null; business_name: string; business_slug: string | null; business_id: string; uses_per_purchase: number; valid_days: number | null };
type LiveService = { id: string; name: string; price_pence: number; duration_minutes: number; business_name: string; business_slug: string | null; business_id: string };

const gbp = (pence: number) => (pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`);

export function mapLiveCommerce(d: { products: LiveProduct[]; offers: LiveOffer[]; passes: LivePass[]; services: LiveService[] }): Record<Pillar, Merch[]> {
  return {
    shop: d.products.map((p) => ({ id: p.id, pillar: "shop" as const, title: p.title, business: p.business_name, price: gbp(p.price_pence), image: p.photo ?? undefined, href: `/product/${p.id}` })),
    offers: d.offers.map((o) => ({ id: o.id, pillar: "offers" as const, title: o.title, business: o.business?.name ?? "", badge: "Offer", meta: `Until ${new Date(o.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, href: o.business ? `/directory/${o.business.id}` : "/local#offers" })),
    book: d.services.map((s) => ({ id: s.id, pillar: "book" as const, title: s.name, business: s.business_name, price: `from ${gbp(s.price_pence)}`, meta: `${s.duration_minutes} min`, href: `/directory/${s.business_slug ?? s.business_id}?book=${s.id}` })),
    experiences: d.passes.map((p) => ({ id: p.id, pillar: "experiences" as const, title: p.name, business: p.business_name, price: gbp(p.price_pence), image: p.image_url ?? undefined, meta: `${p.uses_per_purchase > 1 ? `${p.uses_per_purchase} uses` : "1 use"}${p.valid_days ? ` · valid ${p.valid_days} days` : ""}`, href: `/directory/${p.business_slug ?? p.business_id}` })),
  };
}
