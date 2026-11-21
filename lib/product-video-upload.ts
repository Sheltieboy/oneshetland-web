"use client";
/**
 * product-video-upload.ts — getting a seller's MP4, and a still frame from it, into storage.
 *
 * It reuses the product photograph upload exactly: a direct PUT to Supabase Storage with the
 * seller's own JWT, under `{businessId}/products/...`, so the bucket's own policies decide whether
 * they may write there. There is no server route, no service key and no new dependency.
 *
 * THE POSTER IS MADE HERE, in the browser, by drawing one frame of the video onto a canvas. That
 * keeps the whole thing dependency-free — no transcoding service, no ffmpeg — and it means the
 * thumbnail is a real frame of their video rather than a grey box. If the browser will not give us a
 * frame (an unusual codec, a tainted canvas) we say so and refuse the upload rather than storing a
 * video with nothing to show for it.
 */
import { createClient } from "@/lib/supabase/client";

export const VIDEO_BUCKET = "business-video";
export const IMAGE_BUCKET = "business-media";

/** Seek a little way in: frame zero of a fade-in is usually black. */
const POSTER_AT_SECONDS = 1.0;
const POSTER_MAX_EDGE = 1280;

export interface VideoUpload { url: string; poster: string; duration: number | null }

async function putObject(bucket: string, path: string, body: Blob, token: string): Promise<string> {
  const form = new FormData();
  form.append("file", body);
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${token}`,
      "x-upsert": "true",
    },
    body: form,
  });
  if (!res.ok) {
    // The bucket's own limits answer here, and its answers are the useful ones.
    if (res.status === 413) throw new Error("That file is too big for the gallery.");
    if (res.status === 415) throw new Error("That file type is not accepted. Videos must be MP4.");
    if (res.status === 403) throw new Error("You do not have permission to add media to this business.");
    throw new Error(`Upload failed (${res.status}).`);
  }
  return createClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** One frame of the video, as a JPEG, plus how long the video is. */
export async function posterFromVideo(file: File): Promise<{ blob: Blob; duration: number | null }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;               // required for a silent seek on mobile
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error("We could not read that video. Please export it as an MP4 (H.264) and try again."));
      video.onloadedmetadata = () => resolve();
      video.onerror = fail;
      setTimeout(fail, 20_000);
    });
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;

    await new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error("We could not take a thumbnail from that video. Please export it as an MP4 (H.264) and try again."));
      video.onseeked = () => resolve();
      video.onerror = fail;
      setTimeout(fail, 20_000);
      // Never seek past the end of a very short clip.
      video.currentTime = duration && duration > POSTER_AT_SECONDS + 0.2 ? POSTER_AT_SECONDS : 0;
    });

    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) throw new Error("That video has no picture we can read.");
    const scale = Math.min(1, POSTER_MAX_EDGE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("We could not take a thumbnail from that video.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("We could not take a thumbnail from that video.");
    return { blob, duration };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

/**
 * The video and its poster. The POSTER GOES FIRST, deliberately: a video with no thumbnail would
 * leave a hole in the gallery, so if the poster cannot be stored we never store the video either.
 */
export async function uploadProductVideo(businessId: string, file: File): Promise<VideoUpload> {
  const sb = createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const { blob, duration } = await posterFromVideo(file);
  const stem = `${businessId}/products/${crypto.randomUUID()}`;
  const poster = await putObject(IMAGE_BUCKET, `${stem}-poster.jpg`, blob, session.access_token);
  const url = await putObject(VIDEO_BUCKET, `${stem}.mp4`, file, session.access_token);
  return { url, poster, duration };
}

/** The photograph path, unchanged in behaviour — kept here so both uploads read alike. */
export async function uploadProductImage(businessId: string, file: File): Promise<string> {
  const sb = createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return putObject(IMAGE_BUCKET, `${businessId}/products/${crypto.randomUUID()}.${ext}`, file, session.access_token);
}
