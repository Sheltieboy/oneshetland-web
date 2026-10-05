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
  /** The Admin-only "future live preview" (what the page becomes after the owner approves and goes live). */
  futureLiveBar: "Future live preview · Not public",
  futureLiveIntro: "This is how your page will look once you have reviewed it, approved it and gone live. Products, services, experiences and rewards appear here only when they are real in OneShetland.",
  /** Review-only markers that show where real content will slot in. Never part of what customers see. */
  slotTag: "Review note · not shown to customers",
  slot: {
    shop: "Your real products appear here automatically once they are imported or added in OneShetland.",
    book: "Your real bookable services appear here once bookings are switched on in OneShetland.",
    experience: "Experiences and passes appear here once they are created in OneShetland.",
    rewards: "Your loyalty rewards appear here once a reward programme is created in OneShetland.",
  },
} as const;
