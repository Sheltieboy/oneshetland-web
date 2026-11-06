/**
 * for-you-layout.ts — how many cards the homepage For you strip shows, in what grid, and what hides behind "+N more".
 * Pure, so it is tested directly. Desktop has FOUR slots in a row; a pinned card takes two of them.
 *   1 recommendation  -> one card, capped width      2 -> two columns      3 -> three      4 -> four
 *   pinned + 2        -> fills the row exactly       more than fit -> "+N more", expanding in place (never beyond 8 in total)
 * Phones: 1-2 recommendations stack; 3+ become a swipe row whose next card peeks in. The pinned card is a banner above either.
 */
export const DESKTOP_SLOTS = 4;
export const MAX_RECS = 8;

export type ForYouLayout = {
  /** Recommendations allowed on the first desktop row. */
  capacity: number;
  /** How many of the recommendations hide behind "+N more" on desktop (0 when expanded). */
  hidden: number;
  /** Tailwind class for the desktop grid. */
  gridClass: string;
  /** Phone arrangement. */
  mobile: "stack" | "swipe";
};

const GRID: Record<number, string> = {
  1: "md:grid-cols-[minmax(0,26rem)]",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

export function forYouLayout(recs: number, hasPin: boolean, expanded: boolean): ForYouLayout {
  const n = Math.max(0, Math.min(recs, MAX_RECS));
  const capacity = DESKTOP_SLOTS - (hasPin ? 2 : 0);
  const onFirstRow = Math.min(n, capacity);
  const slots = hasPin ? onFirstRow + 2 : onFirstRow;
  // A pinned card with nothing beside it keeps its two-slot width on the four-slot grid (a half-width banner), not the whole row.
  const cols = hasPin && n === 0 ? DESKTOP_SLOTS : Math.min(DESKTOP_SLOTS, Math.max(1, slots));
  return {
    capacity,
    hidden: expanded ? 0 : n - onFirstRow,
    gridClass: GRID[cols] ?? GRID[4],
    mobile: n <= 2 ? "stack" : "swipe",
  };
}

/**
 * Does the For you section appear at all?
 *   recommendations, no pinned card          -> yes (as before)
 *   NO recommendations, active pinned card   -> yes: a brand-new member still sees the launch card
 *   NO recommendations, no pinned card       -> no empty section (as before)
 *   NO recommendations, pinned card DISMISSED -> no empty section
 */
export function forYouShows(recs: number, pinKey: string | null | undefined, dismissed: readonly string[]): boolean {
  const pinShown = !!pinKey && !dismissed.includes(pinKey);
  return recs > 0 || pinShown;
}
