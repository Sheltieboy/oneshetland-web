/**
 * social-links.ts — where the newer Social Studio recipes' /go/* short links land (see app/go/[...slug]/route.ts).
 * Kept out of the route file because a Next route module may only export route handlers.
 */
// Only plain identifiers may be spliced into a redirect path.
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const GAME_SLUGS = new Set(["guess-da-wird", "spik-sprint", "spik-snap", "map-it"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Where a Social Studio link goes, or null if it isn't one of the newer recipes' shapes. */
export function socialDestination(slug: string[]): { path: string; campaign: string; objectType: string; objectId?: string } | null {
  const [head, id] = slug;
  if (head === "notice" && id && SAFE_ID.test(id)) return { path: `/notices/${id}`, campaign: "notice_update", objectType: "notice", objectId: id };
  if (head === "memory" && id && SAFE_ID.test(id)) return { path: `/memories/${id}`, campaign: "aald_memory", objectType: "memory", objectId: id };
  if (head === "business" && id && SAFE_ID.test(id)) return { path: `/directory/${id}`, campaign: "business_spotlight", objectType: "business", objectId: id };
  if (head === "hub" && id && SAFE_ID.test(id)) return { path: `/hubs/${id}`, campaign: "hub_community", objectType: "hub", objectId: id };
  if (head === "games" && id && GAME_SLUGS.has(id)) return { path: `/games/${id}`, campaign: "game_challenge", objectType: "page" };
  if (head === "cruise" && id && DATE.test(id)) return { path: `/cruise/${id}`, campaign: "cruise_visit", objectType: "page" };
  return null;
}

