import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isFestive } from "@/lib/festive";

/**
 * The iOS home-screen icon, in two versions. This used to be app/apple-icon.png; that file is
 * unchanged, at assets/brand/apple-icon.png, and is what this still serves for most of the year.
 * From mid-November to 5 January it serves the festive one instead — same cream ground, same ring
 * span, same centre, so the icon keeps its shape in the dock and only the mark differs.
 *
 * force-dynamic, not a cached build artefact: a statically generated icon would have frozen whichever
 * version was in season at deploy time, and the whole point is that nobody deploys to end the season.
 * The CDN still holds it for an hour, so this runs about 24 times a day.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function AppleIcon() {
  const name = isFestive() ? "apple-icon-festive.png" : "apple-icon.png";
  const png = await readFile(join(process.cwd(), "assets", "brand", name));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
