/**
 * Which business categories are invited to Get it done.
 *
 * OneShetland's business taxonomy is six coarse categories (local_businesses_category_check): food_drink, retail, services, tourism,
 * accommodation, other. There is no joiner/plumber-level category, so the only careful mapping is by identifier:
 *   services  -> invited (trades, repairs, cleaning, personal and professional services all sit here)
 *   other     -> invited (the catch-all; the card says "if you do work for people" so a non-trade can ignore it)
 * Everything else is NOT invited, but can always join by hand from the business hub (Grow -> Get it done: job leads).
 * Joining is never automatic: this only decides whether the invitation is shown.
 */
export const GET_IT_DONE_CATEGORIES = ["services", "other"] as const;

export function isGetItDoneCategory(category: string | null | undefined): boolean {
  return !!category && (GET_IT_DONE_CATEGORIES as readonly string[]).includes(category);
}

/** The one-line status shown once a business has joined. */
export function getItDoneStatus(opts: { isTrade: boolean; availabilityLabel: string | null; availabilityFresh: boolean }): string {
  if (!opts.isTrade) return "Not joined";
  if (!opts.availabilityLabel) return "Joined: availability not set, so no jobs are being sent";
  if (!opts.availabilityFresh) return `Joined: ${opts.availabilityLabel} (out of date, so jobs have paused)`;
  return `Joined: ${opts.availabilityLabel}`;
}
