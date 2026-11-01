/** The Directory shows at most this many rows at once (search and filters reach the rest). */
export const DIRECTORY_LIST_LIMIT = 200;

/** "517 listings", or — when the list was cut off — "Showing 200 of 517 · search to find the rest". */
export function countLabel(shown: number, total: number | null): string {
  if (total !== null && total > shown) return `Showing ${shown} of ${total} · search to find the rest`;
  return `${shown} listing${shown === 1 ? "" : "s"}`;
}

