/**
 * Build the first draft of a campaign from material that already exists — never from the open web.
 *
 * `buildPageDraft` turns an approved Launch Preview into a prepared Business Page V2 draft: the same researched
 * items, re-used, so Darren starts from approved content instead of a blank page. Anything not already in the
 * preview is simply left out; nothing is invented.
 */
import type { PreviewConfig } from "../launch-preview/types.ts";
import type { Emphasis, PageDraft } from "../business-page/types.ts";
import { shorten } from "../business-page/tokens.ts";

/** Which strength leads each existing partner's page (from the approved positioning). */
export const EMPHASIS_BY_SLUG: Record<string, Emphasis> = {
  "love-from-shetland": "shop_first",
  "shetland-jewellery": "story_then_shop",
  "the-dowry": "book_first",
  "peerie-shop": "shop_first",
  "da-craft-shed": "shop_first",
  "shetland-soap-company": "story_then_shop",
};

/** The approved one-line positioning for each existing partner (shown in Admin; never public). */
export const POSITIONING_BY_SLUG: Record<string, string> = {
  "love-from-shetland": "Shop + local gifts (reference design)",
  "shetland-jewellery": "Products + experiences",
  "the-dowry": "Bookings + local discovery + offers/rewards possibilities",
  "peerie-shop": "Shop + local + rewards",
  "da-craft-shed": "Products + Shetland makers",
  "shetland-soap-company": "Products + local/social-enterprise story",
};

export function inferEmphasisForPreview(cfg: PreviewConfig): Emphasis {
  if (EMPHASIS_BY_SLUG[cfg.slug]) return EMPHASIS_BY_SLUG[cfg.slug];
  if (cfg.booking && cfg.products.length === 0) return "book_first";
  if (cfg.story && cfg.products.length) return "story_then_shop";
  if (cfg.products.length) return "shop_first";
  return cfg.experience ? "experience_first" : "story_then_shop";
}

export function buildPageDraft(cfg: PreviewConfig): PageDraft {
  const wantsRewards = (cfg.possibilities ?? ["offers", "rewards", "discovery"]).includes("rewards");
  return {
    version: 1,
    emphasis: inferEmphasisForPreview(cfg),
    hero: {
      headline: cfg.businessName,
      tagline: shorten(cfg.business.description, 150),
      image: { ...cfg.business.image },
    },
    // The researched story if there is one; otherwise the researched description, so the page always has an About.
    story: cfg.story
      ? { eyebrow: cfg.story.eyebrow, title: `${cfg.story.title[0]} ${cfg.story.title[1]}`.trim(), body: cfg.story.body, source: cfg.story.source }
      : { eyebrow: "About", title: `About ${cfg.businessName}`, body: [cfg.business.description], source: cfg.sources.find((x) => x.url.startsWith("https://"))?.url },
    ...(cfg.products.length ? { products: cfg.products.map((p) => ({ ...p })), productsTitle: cfg.productsTitle ? `${cfg.productsTitle[0]} ${cfg.productsTitle[1]}`.replace(/,\s*in the Shop\.?$/i, "").trim() || "Shop" : "Shop" } : {}),
    ...(cfg.experience ? { experience: { ...cfg.experience } } : {}),
    ...(cfg.booking ? { booking: { ...cfg.booking } } : {}),
    ...(wantsRewards ? { rewards: { title: "Rewards for regulars", body: cfg.rewardsNote ?? "An idea for later: a stamp card or points for repeat customers. Nothing is set up unless you choose it." } } : {}),
    notes: "Prepared from the approved launch preview. Everything here is an example until the business adds its own real content.",
  };
}

/* ── Preparing a NEW launch partner from what OneShetland already holds ─────────────────────────────────────── */

export interface DirectoryRecord {
  id: string; name: string; category: string | null; description: string | null; address: string | null; locality: string | null;
  logo_url: string | null; cover_url: string | null; website: string | null; tags: string[] | null;
}

const CATEGORY_WORD: Record<string, { label: string; pillar: string }> = {
  food_drink: { label: "Eat & drink", pillar: "Eat & drink" }, retail: { label: "Shop", pillar: "Shop" }, services: { label: "Services", pillar: "Services" },
  tourism: { label: "Tourism", pillar: "Visit" }, accommodation: { label: "Stay", pillar: "Stay" }, other: { label: "Local business", pillar: "Local" },
};

/** A URL-safe preview name from a business name: "Da Craft Shed" → "da-craft-shed". */
export function slugFromName(name: string): string {
  const s = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 58);
  return /^[a-z0-9][a-z0-9-]{2,60}$/.test(s) ? s : `partner-${s || "business"}`.slice(0, 60);
}

/**
 * The first Launch Preview for a business, from its existing Directory record ONLY. No products, no experiences,
 * no outside research: Darren adds representative items himself in the editor, with their source addresses.
 * Safe to render at once: it says what the Directory already says, and claiming stays closed (holding).
 */
export function buildPreviewSkeleton(r: DirectoryRecord, slug: string): PreviewConfig {
  const word = CATEGORY_WORD[r.category ?? "other"] ?? CATEGORY_WORD.other;
  const photo = r.cover_url ?? r.logo_url;
  const locality = r.locality ?? (r.address ? r.address.split(",").map((x) => x.trim()).filter(Boolean).slice(-1)[0] : null) ?? "Shetland";
  return {
    slug,
    businessName: r.name,
    directoryBusinessId: r.id,
    claim: "holding",
    positioning: undefined,
    hero: {
      support: `We've put together an example of how ${r.name} could look on OneShetland — in front of the locals and visitors already looking for exactly this.`,
      treatment: r.cover_url ? "photo" : "ambient",
    },
    business: {
      categoryLabel: word.label,
      category: (["retail", "food_drink", "services"] as const).find((c) => c === r.category) ?? "retail",
      pillarLabel: word.pillar,
      ...(r.logo_url ? { logo: r.logo_url } : {}),
      locality,
      description: r.description?.trim() || `${r.name} is listed in the OneShetland Directory.`,
      tags: (r.tags ?? []).slice(0, 8),
      image: { src: photo ?? "/logo.png", alt: photo ? `${r.name}` : "OneShetland" },
    },
    products: [],
    possibilities: ["offers", "rewards", "discovery"],
    searchTerm: r.name.split(/\s+/)[0]?.toLowerCase() || "local",
    sourceSite: r.website && /^https:\/\//.test(r.website)
      ? { label: r.website.replace(/^https:\/\//, "").replace(/\/$/, ""), url: r.website }
      : { label: "OneShetland Directory", url: `/directory/${r.id}` },
    sources: [{ label: "OneShetland Directory listing", url: `/directory/${r.id}`, used: "name, description, location and photograph already on the listing" }],
  };
}

/** The first Business Page draft for a brand-new campaign: identity only. Everything richer is added in Admin. */
export function buildPageSkeleton(r: DirectoryRecord): PageDraft {
  const photo = r.cover_url ?? r.logo_url;
  return {
    version: 1,
    hero: { headline: r.name, tagline: r.description ? shorten(r.description, 150) : `${r.name}, ${r.locality ?? "Shetland"}.`, image: { src: photo ?? "/logo.png", alt: r.name } },
    notes: "Started from the existing Directory record. Add a story, example items and a picture that leads.",
  };
}
