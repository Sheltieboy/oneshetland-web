/**
 * cruise-ship-images — curated local photos for specific cruise ships. Keyed by
 * ship slug (which matches the file in /public/cruise-ships). Mirrors the app's
 * lib/cruise-ship-images.ts.
 *
 * These ships' DB `image_url` points to placeholder files in storage, so a
 * curated local photo listed here takes PRECEDENCE over image_url. Remove a
 * ship from this map once a real image_url is set for it in the database.
 */
const LOCAL_SHIP_IMAGES: Record<string, string> = {
  "crystal-serenity": "/cruise-ships/crystal-serenity.jpg",
  "msc-virtuosa": "/cruise-ships/msc-virtuosa.jpeg",
  "viking-mira": "/cruise-ships/viking-mira.jpg",
};

function slugify(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A curated local photo for this ship if we have one (wins over image_url,
 *  which is a placeholder for these ships), else the remote image_url, else
 *  null so the caller renders its placeholder. */
export function shipImageUrl(
  ship?: { slug?: string | null; name?: string | null; image_url?: string | null } | null,
): string | null {
  const key = ship?.slug || slugify(ship?.name);
  if (key && LOCAL_SHIP_IMAGES[key]) return LOCAL_SHIP_IMAGES[key];
  return ship?.image_url || null;
}
