/**
 * festive.ts — the Christmas and New Year brand, and the date it hands itself back.
 *
 * OneShetland wears a festive version of its ring mark for one season. This is a THEME, not a
 * rebrand: the original artwork is untouched and still shipped (public/brand/logo-mark-keyed.png,
 * assets/brand/*.png), and every surface asks this file which of the two to show. On 6 January the
 * answer changes on its own. Nobody has to remember, and nobody has to deploy.
 *
 * WHY A DAY KEY AND NOT A TIMESTAMP. "Until the 6th of January" is a UK calendar statement, and the
 * machine rendering it is not in the UK — Netlify's builders and functions run on UTC. Comparing
 * instants would have switched the branding back at midnight UTC, which in GMT is the right moment
 * by luck and in BST would be an hour early; and the first of those is only true for half the year.
 * shetlandDayKey() asks the timezone database which Shetland day an instant falls on and returns it
 * as YYYY-MM-DD, which sorts lexically — so the window is two string comparisons and no arithmetic.
 *
 * WHERE THE ANSWER IS DECIDED. For the site chrome — header, footer, install prompt — in the root
 * layout, on the server, once per request, and passed down as a prop. Those are client components,
 * and a client component that worked the date out for itself would render one mark on the server and
 * could render the other in the browser, which React then has to patch.
 *
 * The sign-in and create-account pages are client components with no server parent to pass a prop
 * from, so they do call isFestive() directly. The only render that can disagree with itself is the
 * one that straddles midnight on 6 January, and all that is at stake there is which ring image a
 * single <img> points at. Leaving those two marks ordinary was the alternative, and it would have
 * put an everyday mark on the card directly under a festive one in the header.
 */
import { shetlandDayKey } from "./shetland-time.ts";

/** The first festive day, and the first ordinary day after it (exclusive). Shetland dates. */
export const FESTIVE_FROM = "2026-11-18";
export const FESTIVE_UNTIL = "2027-01-06";

/** True while the festive brand is in season. Pass a date to ask about another day. */
export function isFestive(now: Date = new Date()): boolean {
  const day = shetlandDayKey(now);
  return day >= FESTIVE_FROM && day < FESTIVE_UNTIL;
}

/** The ring mark: the everyday one, and the one with the snow, the gold and the holly. */
export const BRAND_MARK = "/brand/logo-mark-keyed.png";
export const FESTIVE_MARK = "/brand/festive/logo-mark-festive.png";

/** The mark to show. One function so no surface can pick the festive art and keep the ordinary date. */
export const brandMark = (festive: boolean): string => (festive ? FESTIVE_MARK : BRAND_MARK);
