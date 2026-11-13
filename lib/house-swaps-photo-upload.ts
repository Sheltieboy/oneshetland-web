/**
 * house-swaps-photo-upload.ts — the ONE browser-side path a House Swaps photo takes, shared by the picker used while writing a new
 * advert and by the manager used on a saved one. Keeping it in one place keeps the privacy work identical on both: every file is
 * re-encoded through a canvas, which carries pixels only, so EXIF (including GPS) never leaves the member's device.
 *
 * Storage and registration are the existing ones: the member's own folder in the `house-swap-photos` bucket, then the
 * `add_my_house_swap_photo` RPC, which attaches the photo to their advert and sends a live advert back for re-checking.
 */
import { createClient } from "@/lib/supabase/client";
import { fitWithin, newPhotoPath } from "@/lib/house-swaps";

export const PHOTO_BUCKET = "house-swap-photos";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** What a member may choose before anything is uploaded. Returns the reason it cannot be used, or null. */
export function photoProblem(file: File): string | null {
  if (!file.type.startsWith("image/")) return `"${file.name}" is not a photo. Please choose a JPEG, PNG or WebP picture.`;
  if (file.size > MAX_PHOTO_BYTES) return `"${file.name}" is larger than 5 MB. Please choose a smaller photo.`;
  return null;
}

/** Re-encode through a canvas: caps the size at 1600px and drops EXIF/GPS (a canvas carries pixels only). */
export async function reencode(file: File): Promise<Blob> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions); }
  catch { throw new Error(`"${file.name}" could not be read as a photo. Please try a different JPEG, PNG or WebP picture.`); }
  const { width, height } = fitWithin(bmp.width, bmp.height, 1600);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't prepare photos.");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);   // JPEG has no transparency
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
  if (!blob) throw new Error("That photo could not be prepared.");
  return blob;
}

/**
 * Prepare one photo, put it in the member's own folder and attach it to their advert.
 * The advert must already exist. A file that uploads but cannot be attached is deleted again, so storage never keeps an orphan.
 */
export async function uploadOnePhoto(file: File, userId: string, alt: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const bad = photoProblem(file);
  if (bad) return { ok: false, error: bad };
  const sb = createClient();
  let path = "";
  try {
    const blob = await reencode(file);
    path = newPhotoPath(userId, crypto.randomUUID());
    const up = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) return { ok: false, error: `"${file.name}" could not be uploaded. Please try again.` };
    const reg = await sb.rpc("add_my_house_swap_photo", { p_path: path, p_alt: alt?.trim() || null });
    if (reg.error) {
      await sb.storage.from(PHOTO_BUCKET).remove([path]);
      return { ok: false, error: reg.error.message };
    }
    return { ok: true };
  } catch (e) {
    if (path) await sb.storage.from(PHOTO_BUCKET).remove([path]).catch(() => undefined);
    return { ok: false, error: e instanceof Error ? e.message : `"${file.name}" could not be added.` };
  }
}
