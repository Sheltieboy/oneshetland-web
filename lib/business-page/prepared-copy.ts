/**
 * Words that exist ONLY in the prepared (private) preview.
 *
 * Every phrase that marks something as an example, a suggestion or a possibility lives here and nowhere else, and is
 * imported only by code paths that run in `prepared` mode. The customer-facing (`live`) page therefore cannot
 * contain them: a permanent test checks that no live-capable component or model file spells them out itself, and
 * that a live model never carries an example item at all.
 */
export const PREPARED_COPY = {
  bar: "Private draft · Not public",
  intro: "This is a private preview of how your real OneShetland page could look. Example sections disappear unless you choose to set them up.",
  tag: "Example · not live",
  notForSale: "Example · not for sale",
  bookingNote: "Example, based on the booking your own website already takes. Nothing can be booked here yet.",
  experienceNote: "Example, based on what your own website already says. Not bookable here yet.",
  rewardsTag: "Suggestion · not set up",
} as const;
