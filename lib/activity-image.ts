/**
 * activity-image.ts — the ONE place an activity photograph is checked, resized and named. Pure helpers plus the sharp pipeline (server only).
 *
 * Contract: the bytes decide the type (JPEG, PNG or WebP by magic number; SVG and everything else is refused), the file is re-encoded to WebP
 * (EXIF orientation applied, all metadata including GPS stripped), and two sizes are stored: a 1600px "hero" and a 640px "thumb". The stored name
 * is a random uuid, so a draft's photo address cannot be guessed. Deleting only ever touches files that match this exact shape.
 */
import { sniffImage, ImageFetchError } from "./product-import/image-fetch.ts";
import type { ActivityBucket } from "./activity-image-url.ts";
export { heroPath, thumbPath, parseOwnActivityImage, thumbUrl } from "./activity-image-url.ts";

export const ACTIVITY_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // what we accept in a request (the host's request limit is ~6 MB)
export const ACTIVITY_IMAGE_MAX_PIXELS = 50_000_000;      // decompression-bomb guard
export const HERO_WIDTH = 1600;
export const THUMB_WIDTH = 640;

export class ActivityImageError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = "ActivityImageError"; this.status = status; }
}

/** Throws ActivityImageError with a plain-English reason unless the bytes are an acceptable JPEG, PNG or WebP. */
export function checkActivityImageBytes(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new ActivityImageError("That file is empty.");
  if (bytes.length > ACTIVITY_IMAGE_MAX_BYTES) throw new ActivityImageError("That photo is over 5 MB. Choose a smaller one.", 413);
  try { sniffImage(bytes); } catch (e) {
    throw new ActivityImageError(e instanceof ImageFetchError && e.code === "svg" ? "SVG images are not accepted. Use a JPEG, PNG or WebP photo." : "That file is not a JPEG, PNG or WebP photo.", 415);
  }
}

/** Re-encode to WebP at hero and thumb sizes. Never enlarges. Rejects anything sharp cannot decode, or an absurd pixel count. */
export async function processActivityImage(bytes: Uint8Array): Promise<{ hero: Buffer; thumb: Buffer; width: number; height: number }> {
  checkActivityImageBytes(bytes);
  const { default: sharp } = await import("sharp");
  try {
    const base = () => sharp(bytes, { limitInputPixels: ACTIVITY_IMAGE_MAX_PIXELS, failOn: "error" }).rotate();
    const hero = await base().resize({ width: HERO_WIDTH, height: HERO_WIDTH, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true });
    const thumb = await base().resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: "inside", withoutEnlargement: true }).webp({ quality: 74, effort: 4 }).toBuffer();
    if (hero.info.width < 200 || hero.info.height < 120) throw new ActivityImageError("That photo is too small. Use one at least 200 pixels wide.");
    return { hero: hero.data, thumb, width: hero.info.width, height: hero.info.height };
  } catch (e) {
    if (e instanceof ActivityImageError) throw e;
    throw new ActivityImageError("That photo could not be read. Try another file.", 422);
  }
}

/** The storage folder and bucket an activity's photos belong to. The folder is what the storage policy checks against the signed-in user. */
export function storageTarget(a: { organiser_business_id: string | null; organiser_hub_id: string | null; is_platform_activity: boolean }, uid: string): { bucket: ActivityBucket; prefix: string } {
  if (a.is_platform_activity) return { bucket: "event-media", prefix: uid };
  if (a.organiser_business_id) return { bucket: "business-media", prefix: a.organiser_business_id };
  if (a.organiser_hub_id) return { bucket: "hub-media", prefix: a.organiser_hub_id };
  throw new ActivityImageError("This activity has no organiser.", 409);
}
