/** Pure helpers for activity photo addresses: no server-only imports, so cards and the browser can use them. See activity-image.ts. */
const BUCKETS = ["business-media", "hub-media", "event-media"] as const;
export type ActivityBucket = (typeof BUCKETS)[number];

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const OWN = new RegExp(`/storage/v1/object/public/(${BUCKETS.join("|")})/(${UUID})/activity/(${UUID})(-sm)?\\.webp$`, "i");

/** `{owner}/activity/{uuid}.webp` and its thumb name. */
export const heroPath = (prefix: string, id: string) => `${prefix}/activity/${id}.webp`;
export const thumbPath = (prefix: string, id: string) => `${prefix}/activity/${id}-sm.webp`;

/** Our own stored activity photo, or null for anything else (an unknown address is never deleted or rewritten). */
export function parseOwnActivityImage(url: string | null | undefined): { bucket: ActivityBucket; prefix: string; id: string } | null {
  if (!url) return null;
  let path: string;
  try { const u = new URL(url); if (u.protocol !== "https:") return null; path = u.pathname; } catch { return null; }
  const m = path.match(OWN);
  return m ? { bucket: m[1].toLowerCase() as ActivityBucket, prefix: m[2].toLowerCase(), id: m[3].toLowerCase() } : null;
}

/** The small version of a stored photo, for cards and the strip. Anything that is not one of ours is returned unchanged. */
export function thumbUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return parseOwnActivityImage(url) ? url.replace(/\.webp$/i, "-sm.webp") : url;
}

