/**
 * product-media.ts — what a product's gallery IS, with no server or browser dependency so the
 * product page, the seller's editor and a test can all agree on it.
 *
 * TWO FIELDS, ONE GALLERY. `products.photos` is the ordered list of still images and has been since
 * the shop was built: 46 places in the web read it, the mobile app reads it in three `select('*')`
 * calls and writes it through a field list that does not mention media, and the product importer
 * APPENDS to it. `products.media` is the newer ordered gallery that can also hold videos.
 *
 * They are not synchronised. The gallery is DERIVED from both, by a rule that is correct after any
 * write by any client, old or new:
 *
 *   1. every VIDEO in media, in its place                   — only the new editor can add one
 *   2. every IMAGE in media that is STILL in photos         — so a deletion in the app disappears
 *   3. then any photo not already in media, appended        — so an import's new picture appears
 *
 * That is why the mobile app needs no change and no OTA: it can add and remove photographs freely,
 * and the videos a seller arranged on the website survive it.
 */

export type MediaKind = "image" | "video";

export interface MediaItem {
  kind: MediaKind;
  url: string;
  /** Required on a video: the still frame shown before it plays. */
  poster?: string | null;
  /** Seconds, when we could read it from the file. Display only. */
  duration?: number | null;
}

/** One entry in the gallery a page actually renders. */
export interface GalleryItem {
  kind: MediaKind;
  url: string;
  /** For a video, the poster. For an image, the image itself — so a caller can always show something. */
  still: string;
  duration?: number | null;
}

/** Matches the database CHECK (products_media_shape). Keep the two in step. */
export const MEDIA_LIMITS = {
  /** The whole gallery. */
  maxItems: 10,
  /** Photographs, which is what the editor allowed before videos existed. */
  maxImages: 5,
  maxVideos: 2,
  /** Enforced for real by the business-video bucket, which is the only limit a browser cannot dodge. */
  maxVideoBytes: 50 * 1024 * 1024,
  /** Enforced for real by the business-media bucket. */
  maxImageBytes: 10 * 1024 * 1024,
  videoMimes: ["video/mp4"] as const,
  imageMimes: ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const,
} as const;

export const isMediaItem = (v: unknown): v is MediaItem => {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (o.kind !== "image" && o.kind !== "video") return false;
  if (typeof o.url !== "string" || !o.url.trim()) return false;
  if (o.kind === "video" && (typeof o.poster !== "string" || !o.poster.trim())) return false;
  return true;
};

/** Whatever the database handed us, as a list we can trust. Anything malformed is dropped, not thrown. */
export function readMedia(raw: unknown): MediaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isMediaItem).map((m) => ({
    kind: m.kind,
    url: m.url.trim(),
    poster: m.kind === "video" ? (m.poster ?? "").trim() : (m.poster ?? null),
    duration: typeof m.duration === "number" && Number.isFinite(m.duration) ? m.duration : null,
  }));
}

/**
 * THE RULE. See the note at the top of this file for why it is a derivation and not a sync.
 *
 * With no media at all this returns exactly `photos`, which is what every product in the shop has
 * today — so the gallery is unchanged for all of them until somebody adds a video.
 */
export function galleryFrom(rawMedia: unknown, photos: readonly string[] | null | undefined): GalleryItem[] {
  const pics = (photos ?? []).filter((p): p is string => typeof p === "string" && !!p.trim()).map((p) => p.trim());
  const media = readMedia(rawMedia);

  if (media.length === 0) return pics.map((url) => ({ kind: "image" as const, url, still: url }));

  const picSet = new Set(pics);
  const out: GalleryItem[] = [];
  const used = new Set<string>();
  const seenVideos = new Set<string>();

  for (const m of media) {
    if (m.kind === "video") {
      if (seenVideos.has(m.url)) continue;
      seenVideos.add(m.url);
      const poster = (m.poster ?? "").trim();
      out.push({ kind: "video", url: m.url, still: poster, duration: m.duration ?? null });
      // A poster may also be sitting in `photos` so that a video-only product still has a thumbnail
      // in the shop lists. Mark it used, or it would come back as a separate photograph as well.
      if (poster) used.add(poster);
      continue;
    }
    // An image survives only while it is still one of the product's photographs — and only once,
    // however many times it appears in either list.
    if (picSet.has(m.url) && !used.has(m.url)) {
      out.push({ kind: "image", url: m.url, still: m.url });
      used.add(m.url);
    }
  }
  for (const p of pics) if (!used.has(p)) out.push({ kind: "image", url: p, still: p });
  return out;
}

/**
 * What goes back into products.photos when the seller saves: the still images, in order.
 *
 * A gallery of nothing but videos would otherwise leave photos empty, and 46 places read that field
 * for a product's thumbnail — the shop lists, the home shelves, the social image, the mobile app. So
 * a video-only gallery contributes its POSTERS instead, and the product still has a picture
 * everywhere. galleryFrom() knows about this and will not show a poster twice.
 */
export function photosFromGallery(items: readonly GalleryItem[]): string[] {
  const images = items.filter((i) => i.kind === "image").map((i) => i.url);
  if (images.length > 0) return images;
  return items.filter((i) => i.kind === "video" && i.still).map((i) => i.still);
}

/** The gallery as it should be stored in products.media. */
export const mediaFromGallery = (items: readonly GalleryItem[]): MediaItem[] =>
  items.map((i) =>
    i.kind === "video"
      ? { kind: "video" as const, url: i.url, poster: i.still, duration: i.duration ?? null }
      : { kind: "image" as const, url: i.url });

/** Move an item, for the reorder controls. Returns a new array; out-of-range moves are no-ops. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const countKind = (items: readonly GalleryItem[], kind: MediaKind): number =>
  items.filter((i) => i.kind === kind).length;

/** Why a file cannot be added, in words a seller can act on. Null means it is fine. */
export function rejectUpload(file: { type: string; size: number }, items: readonly GalleryItem[]): string | null {
  const isVideo = (MEDIA_LIMITS.videoMimes as readonly string[]).includes(file.type);
  const isImage = (MEDIA_LIMITS.imageMimes as readonly string[]).includes(file.type);
  if (!isVideo && !isImage) {
    return "That file type is not supported. Photographs can be JPEG, PNG or WebP; videos must be MP4.";
  }
  if (items.length >= MEDIA_LIMITS.maxItems) {
    return `A gallery holds up to ${MEDIA_LIMITS.maxItems} items.`;
  }
  if (isVideo) {
    if (countKind(items, "video") >= MEDIA_LIMITS.maxVideos) {
      return `Up to ${MEDIA_LIMITS.maxVideos} videos. Remove one first.`;
    }
    if (file.size > MEDIA_LIMITS.maxVideoBytes) {
      return `That video is ${mib(file.size)} and the limit is ${mib(MEDIA_LIMITS.maxVideoBytes)}. Trim it, or export it smaller.`;
    }
  } else {
    if (countKind(items, "image") >= MEDIA_LIMITS.maxImages) {
      return `Up to ${MEDIA_LIMITS.maxImages} photographs. Remove one first.`;
    }
    if (file.size > MEDIA_LIMITS.maxImageBytes) {
      return `That photograph is ${mib(file.size)} and the limit is ${mib(MEDIA_LIMITS.maxImageBytes)}.`;
    }
  }
  return null;
}

const mib = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

/** mm:ss, for the badge on a video thumbnail. */
export function durationLabel(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
