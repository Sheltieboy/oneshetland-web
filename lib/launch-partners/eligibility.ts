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
 * Whether a launch preview can be PREPARED depends only on is_active: a preview is a private draft built from the live
 * record, so a hidden test fixture is a perfectly good subject, while an inactive record has nothing to draft from.
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

export function prepareEligibility(f: ListingFacts): PrepareEligibility {
  const state = listingState(f);
  if (!f.is_active) return { ok: false, state, reason: "That business isn't active in the OneShetland Directory, so there's nothing to draft a preview from." };
  return { ok: true, state };
}

/** One call for everything a screen needs. */
export function eligibilityOf(f: ListingFacts) {
  const prep = prepareEligibility(f);
  return { state: prep.state, label: LISTING_LABEL[prep.state], tone: LISTING_TONE[prep.state], canPrepare: prep.ok, reason: prep.ok ? null : prep.reason };
}
