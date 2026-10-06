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
 *   existing_content  OneShetland already holds enough (products/services/offers/passes, or a real description): build from it.
 *   enrich            a sparse listing WITH a website: Peerie Bot reads the website and builds a private draft.
 *   needs_source      a sparse listing with no website: we don't have enough to build automatically; ask for a source.
 */
export type PreparationRoute = "existing_content" | "enrich" | "needs_source";
export interface PreparationFacts { description_length: number; commerce_count: number; website: string | null }

/** A listing is "rich" when it has real commerce or a description of real length (120+ characters). */
export const RICH_DESCRIPTION_CHARS = 120;

export function preparationRoute(f: PreparationFacts, websiteOk: boolean): PreparationRoute {
  if (f.commerce_count > 0 || f.description_length >= RICH_DESCRIPTION_CHARS) return "existing_content";
  return f.website && websiteOk ? "enrich" : "needs_source";
}

export const REASSURANCE = "Nothing on the live business listing will change.";
export const ROUTE_LABEL: Record<PreparationRoute, string> = {
  existing_content: "OneShetland content available",
  enrich: "Sparse listing — Peerie Bot can build a draft",
  needs_source: "Not enough source information",
};
export const ROUTE_TONE: Record<PreparationRoute, "green" | "blue" | "amber"> = { existing_content: "green", enrich: "blue", needs_source: "amber" };
export const routeNote = (r: PreparationRoute, host: string | null): string =>
  r === "existing_content" ? "The draft is built mostly from what OneShetland already holds."
  : r === "enrich" ? `Peerie Bot will read ${host ?? "the website"} and build a private draft you can review and edit.`
  : "We don't have enough public information to build this automatically. Add the business's website below and Peerie Bot will build the draft from it.";

/** One call for everything a screen needs. */
export function eligibilityOf(f: ListingFacts) {
  const prep = prepareEligibility(f);
  return { state: prep.state, label: LISTING_LABEL[prep.state], tone: LISTING_TONE[prep.state], canPrepare: true as boolean, reason: null as string | null };
}
