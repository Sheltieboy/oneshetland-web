import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isFestive } from "@/lib/festive";

/**
 * The card Facebook, WhatsApp and the rest show when oneshetland.com is shared. This used to be
 * app/opengraph-image.png; that file is unchanged, at assets/brand/opengraph-image.png. In season it
 * serves the festive card, which is the same card — same wordmark, same three lines, same colour bar
 * — with the festive ring in place of the ordinary one.
 *
 * It stays a file-convention metadata route rather than moving into metadata.openGraph.images so that
 * it keeps cascading to every page that does not set a card of its own, exactly as the PNG did.
 * Pages with their own opengraph-image (the Editions pages) are unaffected.
 *
 * force-dynamic for the same reason as the icon: the season has to be able to end without a deploy.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "OneShetland — Shop Shetland. Discover Shetland. OneShetland.";
export const dynamic = "force-dynamic";

export default async function OpengraphImage() {
  const name = isFestive() ? "opengraph-image-festive.png" : "opengraph-image.png";
  const png = await readFile(join(process.cwd(), "assets", "brand", name));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
