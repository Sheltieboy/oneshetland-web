/**
 * Launch partners — the ONE place that decides how a Directory business is described and whether a launch preview can
 * be prepared for it. The search results (what the card says) and the Prepare action (what is allowed) both call this,
 * so they cannot disagree.
 *
 * Two facts, deliberately kept apart:
 *   is_active         the Directory record is live (the raw flag on the business)
 *   publicly_visible  an ANONYMOUS visitor can actually see it — i.e. it is active AND not hidden from public discovery
 *                     (test fixtures are registered in `discovery_fixtures` and hidden from everyone but admins)
 *
 * What the CARD says depends on both: "Publicly listed" only when a visitor genuinely sees it.
 * Whether a launch preview can be PREPARED no longer depends on the listing at all. A preview is a PRIVATE draft; the very
 * businesses it is most useful for are often unclaimed, Free and not publicly listed. Being inactive or hidden is a fact to
 * show, never a reason to refuse. What decides HOW a draft is built is how much OneShetland already knows (preparationRoute).
 *
 * Pure: no database, no framework.
 */

export type ListingState = "listed" | "hidden_from_public" | "unlisted";

export interface ListingFacts { is_active: boolean; publicly_visible: boolean }

export const LISTING_LABEL: Record<ListingState, string> = {
  listed: "Publicly listed",
  hidden_from_public: "Hidden from public discovery",
  unlisted: "Not publicly listed",
};
export const LISTING_TONE: Record<ListingState, "green" | "purple" | "gray"> = { listed: "green", hidden_from_public: "purple", unlisted: "gray" };

/** What a visitor can actually see. An inactive record is never listed, even if some other check says visible. */
export function listingState(f: ListingFacts): ListingState {
  if (!f.is_active) return "unlisted";
  return f.publicly_visible ? "listed" : "hidden_from_public";
}

export type PrepareEligibility = { ok: true; state: ListingState } | { ok: false; state: ListingState; reason: string };

/** Always ok: any existing Directory business can have a private draft prepared. The listing is never read as a blocker and never changed. */
export function prepareEligibility(f: ListingFacts): PrepareEligibility {
  return { ok: true, state: listingState(f) };
}

/* ── how a draft is built ─────────────────────────────────────────────────── */

/**
 * CONTENT richness — a different question from listing state, ownership or plan, and kept apart from them on purpose:
 * the inputs below are the ONLY facts the classifier reads (active / publicly visible / claimed / owner / tier are not here).
 *
 * "OneShetland content available" means OneShetland already holds enough to build a genuinely useful private preview
 * WITHOUT reading the business's website. Exactly one of these must be true:
 *
 *   1. REAL COMMERCE — at least one product, service, offer or pass. These are real OneShetland records the page is built around.
 *   2. A REAL PROFILE — a meaningful description (200+ characters of text) AND a usable hero picture (a cover photograph).
 *
 * Anything else is SPARSE. In particular none of these is enough on its own: a category, a location, a logo, tags, a website
 * address, or a long description with no picture (a biography alone gives a page with nothing to look at).
 *
 *   existing_content  the rule above holds: the draft is built mostly from what OneShetland already holds. No AI runs.
 *   enrich            sparse, WITH a usable website: Peerie Bot reads the website and builds a private draft.
 *   needs_source      sparse, with no usable website: ask for one — nothing is guessed.
 */
export type PreparationRoute = "existing_content" | "enrich" | "needs_source";
export interface PreparationFacts {
  /** Characters of the Directory description, trimmed (0 when none). */
  description_length: number;
  /** A cover photograph exists. A logo does not count: it is a mark, not a picture to lead a page with. */
  has_cover_image: boolean;
  /** products + services + offers + passes that really exist for the business. */
  commerce_count: number;
  website: string | null;
}

/** A description is "meaningful" at this many characters — roughly two real sentences, not an imported blurb. */
export const MEANINGFUL_DESCRIPTION_CHARS = 200;

export function hasSubstantiveContent(f: Pick<PreparationFacts, "description_length" | "has_cover_image" | "commerce_count">): boolean {
  return f.commerce_count > 0 || (f.description_length >= MEANINGFUL_DESCRIPTION_CHARS && f.has_cover_image);
}

export function preparationRoute(f: PreparationFacts, websiteOk: boolean): PreparationRoute {
  if (hasSubstantiveContent(f)) return "existing_content";
  return f.website && websiteOk ? "enrich" : "needs_source";
}

export const REASSURANCE = "Nothing on the live business listing will change.";
export const ROUTE_LABEL: Record<PreparationRoute, string> = {
  existing_content: "OneShetland content available",
  enrich: "Sparse listing — Peerie Bot can build a private draft",
  needs_source: "Not enough source information",
};
export const ROUTE_TONE: Record<PreparationRoute, "green" | "blue" | "amber"> = { existing_content: "green", enrich: "blue", needs_source: "amber" };
export const routeNote = (r: PreparationRoute, host: string | null): string =>
  r === "existing_content" ? "The draft is built mostly from existing OneShetland content. Peerie Bot is not used."
  : r === "enrich" ? `Peerie Bot will use public business information from ${host ?? "the website"} to build a private draft you can review and edit.`
  : "We don't have enough public information to build this automatically. Add the business's website below and Peerie Bot will use it to build a private draft.";

/** One call for everything a screen needs. */
export function eligibilityOf(f: ListingFacts) {
  const prep = prepareEligibility(f);
  return { state: prep.state, label: LISTING_LABEL[prep.state], tone: LISTING_TONE[prep.state], canPrepare: true as boolean, reason: null as string | null };
}
