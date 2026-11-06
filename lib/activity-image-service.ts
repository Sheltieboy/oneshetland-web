/**
 * activity-image-service.ts — the steps of adding, replacing and removing an activity photo, written against a small client interface so the
 * same code runs with the signed-in person's Supabase client in production and with a rules-enforcing fake in tests. It changes `cover_url`
 * and nothing else on the activity.
 */
import { ActivityImageError, processActivityImage, storageTarget } from "./activity-image.ts";
import { heroPath, parseOwnActivityImage, thumbPath } from "./activity-image-url.ts";

export type ActivityRow = { id: string; organiser_business_id: string | null; organiser_hub_id: string | null; is_platform_activity: boolean; cover_url: string | null };
type StorageResult = { error: unknown | null };
export interface PhotoClient {
  storage: { from(bucket: string): {
    upload(path: string, body: Uint8Array, opts: { contentType: string; cacheControl: string; upsert: false }): PromiseLike<StorageResult>;
    remove(paths: string[]): PromiseLike<unknown>;
    getPublicUrl(path: string): { data: { publicUrl: string } };
  } };
  /** Sets cover_url on one activity and returns the rows that were actually changed (row security can make that none). */
  setCover(activityId: string, url: string | null): PromiseLike<{ changed: number; error: unknown | null }>;
}

/** Remove a replaced or removed photo and its thumb, best effort. Only files with our exact naming are ever touched. */
export async function removeStored(sb: PhotoClient, url: string | null): Promise<void> {
  const own = parseOwnActivityImage(url);
  if (!own) return;
  try { await sb.storage.from(own.bucket).remove([heroPath(own.prefix, own.id), thumbPath(own.prefix, own.id)]); } catch { /* a leftover file is harmless: nothing points at it */ }
}

export async function savePhoto(sb: PhotoClient, uid: string, a: ActivityRow, bytes: Uint8Array, newId: string): Promise<{ cover_url: string; width: number; height: number }> {
  const out = await processActivityImage(bytes);                       // server-side check of the bytes, resize, re-encode, strip metadata
  const { bucket, prefix } = storageTarget(a, uid);
  const opts = { contentType: "image/webp", cacheControl: "31536000", upsert: false } as const;
  const store = sb.storage.from(bucket);
  if ((await store.upload(heroPath(prefix, newId), out.hero, opts)).error) throw new ActivityImageError("You don't have permission to add a photo to this activity.", 403);
  if ((await store.upload(thumbPath(prefix, newId), out.thumb, opts)).error) {
    await store.remove([heroPath(prefix, newId)]);
    throw new ActivityImageError("The photo could not be saved. Please try again.", 500);
  }
  const url = store.getPublicUrl(heroPath(prefix, newId)).data.publicUrl;
  const set = await sb.setCover(a.id, url);
  if (set.error || set.changed !== 1) {
    await store.remove([heroPath(prefix, newId), thumbPath(prefix, newId)]);   // nothing is left behind if it could not be attached
    throw new ActivityImageError("The photo could not be attached. Please try again.", 403);
  }
  await removeStored(sb, a.cover_url);                                 // the old photo goes only after the new one is attached
  return { cover_url: url, width: out.width, height: out.height };
}

export async function dropPhoto(sb: PhotoClient, a: ActivityRow): Promise<void> {
  const set = await sb.setCover(a.id, null);
  if (set.error || set.changed !== 1) throw new ActivityImageError("The photo could not be removed. Please try again.", 403);
  await removeStored(sb, a.cover_url);
}
