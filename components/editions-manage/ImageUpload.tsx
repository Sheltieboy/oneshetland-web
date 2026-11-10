"use client";

import { useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/editions/rules";
import { imageProblem, mediaPath } from "@/lib/editions/validate";
import { renditionName } from "@/lib/editions/images";
import { SafeImage } from "@/components/ui/SafeImage";

/**
 * Before upload every image is re-drawn in the browser: shrunk to a sensible size (photographs 1920px on the long side, logos 800px) and re-encoded (JPEG, or
 * PNG to keep a logo's transparency). That keeps pages fast, and drawing a picture afresh drops its metadata, including any GPS location a phone camera embedded.
 * If the browser cannot do this the original is uploaded unchanged (the bucket still enforces type and size).
 */
export async function prepareImage(file: File, kind: string): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const max = /logo/.test(kind) ? 800 : 1920;
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * k)); canvas.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    const png = file.type === "image/png";
    if (!png) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    const type = png ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, type, 0.82));
    if (!blob) return file;
    if (png && blob.size >= file.size && k === 1) return file; // an already-small PNG is kept as is
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + (png ? ".png" : ".jpg"), { type });
  } catch { return file; }
}

/** A smaller JPEG of an already prepared photograph, for phones. Returns null if the browser cannot draw it. */
async function rendition(file: File, width: number): Promise<File | null> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, width / bmp.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * k)); canvas.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height); bmp.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.78));
    return blob ? new File([blob], `w${width}.jpg`, { type: "image/jpeg" }) : null;
  } catch { return null; }
}

/**
 * Uploads one image to the public `edition-media` bucket under `${organiserId}/${kind}/<uuid>.<ext>` (the storage policy requires the organiser id as the
 * first folder) and reports the public URL. Type and size are checked here before any upload; the bucket enforces them again.
 */
export function ImageUpload({ label, organiserId, kind, value, onChange, round, hint, contain }: {
  label: string; organiserId: string; kind: string; value: string; onChange: (url: string) => void; round?: boolean; hint?: string; /** Show the whole image (logos), not a cropped fill. */ contain?: boolean;
}) {
  const isLogo = contain ?? /logo/.test(kind);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    const problem = imageProblem(file);
    if (problem) { setError(problem); return; }
    setError(null); setBusy(true);
    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setError("Please sign in again to upload."); return; }
      const out = await prepareImage(file, kind);
      const uuid = crypto.randomUUID();
      let name = uuid;
      // Photographs also get 640, 960 and 1280 pixel renditions so phones download a smaller file. If any step fails the photograph is stored as before, with no renditions advertised.
      if (!isLogo && out.type === "image/jpeg" && typeof createImageBitmap === "function") {
        const made = await Promise.all([640, 960, 1280].map((w) => rendition(out, w)));
        if (made.every(Boolean)) {
          let ok = true;
          for (const [i, w] of [640, 960, 1280].entries()) {
            const r = await sb.storage.from("edition-media").upload(mediaPath(organiserId, kind, renditionName(uuid, w), "image/jpeg"), made[i] as File, { contentType: "image/jpeg", upsert: false });
            if (r.error) { ok = false; break; }
          }
          if (ok) name = renditionName(uuid, 1920);
        }
      }
      const path = mediaPath(organiserId, kind, name, out.type);
      const { error: upErr } = await sb.storage.from("edition-media").upload(path, out, { contentType: out.type, upsert: false });
      if (upErr) { setError(friendlyError(upErr.message)); return; }
      onChange(sb.storage.from("edition-media").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <span id={`${id}-l`} className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-3">
        <div className={"grid shrink-0 place-items-center overflow-hidden border border-dashed border-line-strong " + (isLogo ? "bg-white " : "bg-sand/40 ") + (round ? "h-20 w-20 rounded-2xl" : "h-20 w-32 rounded-xl")}>
          {value ? <SafeImage src={value} alt="" className={isLogo ? "h-full w-full object-contain p-2" : "h-full w-full object-cover"} fallback={<span className="px-2 text-center text-xs text-ink-muted">Image unavailable</span>} /> : <span className="text-xs text-ink-soft">No image</span>}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-labelledby={`${id}-l`} onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
          <label htmlFor={id} className={"inline-flex cursor-pointer items-center rounded-pill border border-line-strong bg-paper px-4 py-2 text-sm font-semibold text-ink hover:border-navy focus-within:outline " + (busy ? "opacity-50" : "")}>
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </label>
          {value && !busy && <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-rose-700 hover:underline">Remove</button>}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-muted">{hint ?? "JPEG, PNG or WebP, up to 10 MB."}</p>
      <p aria-live="polite" role={error ? "alert" : undefined} className="mt-1 text-sm font-medium text-rose-700">{error}</p>
    </div>
  );
}
